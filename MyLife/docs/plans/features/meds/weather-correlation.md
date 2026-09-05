# Feature Spec: Weather Correlation

## Metadata
- **Module:** meds
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 4 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Symptom logging (built), measurement trends (built), correlation engine (built)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Barometric pressure changes are a well-documented trigger for migraines, joint pain, and arthritis flares. Bearable ($49.99/yr) is the leading app that correlates weather with health symptoms, showing users that "your headaches are 3.2x more likely on days with >10mb pressure drops." Migraine Buddy ($49.99/yr) also uses weather data as a trigger predictor. Both apps upload user health data to their servers. MyLife can offer the same weather-symptom correlation while keeping all health data local. The weather API call fetches only public weather data (no user data leaves the device). High CrossModule score (4) because weather data can correlate with symptoms across Meds, Health, Mood, and Workouts modules.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Bearable | Yes | Yes ($49.99/yr) | Weather auto-capture, barometric pressure + humidity + temperature correlation, factor analysis dashboard. |
| Migraine Buddy | Yes | Yes ($49.99/yr) | Weather triggers, pressure forecasts, migraine prediction based on weather patterns. |
| CareClinic | Partial | Yes ($119.88/yr) | Manual weather notes. No automatic capture or correlation. |
| WeatherX | Yes | Yes ($19.99/yr) | Pressure-migraine alerts only. No symptom tracking. |
| Medisafe | No | N/A | No weather features. |

### Target User
Migraine sufferers (39M in US, 1B globally), arthritis patients (54M in US), and chronic pain patients who suspect weather triggers but lack data to confirm. Specifically: Bearable users paying $49.99/yr or Migraine Buddy users paying $49.99/yr who want weather-symptom correlation without their health data being uploaded to third-party servers. Migration path: same correlation analysis, all health data stays local.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  weather/
    engine.ts                      -- NEW: Weather data capture, correlation analysis, alert generation
    api.ts                         -- NEW: Weather API client (Open-Meteo, free, no API key)
    __tests__/engine.test.ts       -- NEW: Engine tests (mock API)
  db/
    weather.ts                     -- NEW: CRUD for weather snapshots
    schema.ts                      -- MODIFY: Add md_weather_snapshots table (V4)
  models/
    weather.ts                     -- NEW: Zod schemas for weather data
    index.ts                       -- MODIFY: Export weather models
  definition.ts                    -- MODIFY: Add to V4 migration, add weather screen
  index.ts                         -- MODIFY: Export weather engine + types
apps/mobile/app/(meds)/
  weather.tsx                      -- NEW: Weather correlation dashboard
apps/web/app/meds/
  weather/page.tsx                 -- NEW: Web weather dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Weather alert card: "Pressure dropping, migraine risk elevated"]
       ├── History tab
       │    └── Correlations section
       │         └── [Weather Correlation] ← YOU ARE HERE
       │              ├── [Current weather conditions card]
       │              ├── [Symptom-weather correlation chart]
       │              ├── [Trigger analysis: which weather factors affect you]
       │              └── [Forecast alert: upcoming weather change warnings]
       └── Settings tab
            └── [Weather location configuration]
```

### Data Model

```sql
-- Weather snapshots captured at time of symptom logging
CREATE TABLE IF NOT EXISTS md_weather_snapshots (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  temperature_c REAL,
  humidity_percent REAL,
  pressure_mb REAL,
  pressure_change_3h REAL,
  wind_speed_kmh REAL,
  weather_code INTEGER,
  weather_description TEXT,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Link weather snapshots to symptom logs for correlation
CREATE TABLE IF NOT EXISTS md_weather_symptom_links (
  id TEXT PRIMARY KEY,
  weather_snapshot_id TEXT NOT NULL REFERENCES md_weather_snapshots(id) ON DELETE CASCADE,
  symptom_log_id TEXT NOT NULL REFERENCES md_symptom_logs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(weather_snapshot_id, symptom_log_id)
);
```

### Dependencies
- **Internal:** `@mylife/meds` symptom logging, correlation engine, mood entries
- **External:** Open-Meteo API (free, no API key required, HTTP GET). `expo-location` for device coordinates (one-time permission). Network required only for weather fetch (not for correlation analysis).
- **Cross-Module:** High CrossModule (4). Weather data can correlate with:
  - Mood module: mood entries vs weather
  - Health module: symptom severity vs barometric pressure
  - Workouts module: exercise performance vs temperature/humidity
  - Initially scoped to Meds symptom correlation only; cross-module bridges are future work.

## Functional Requirements

### User Stories
1. As a migraine sufferer, I want to see whether barometric pressure drops correlate with my headaches so I can plan preventive medication.
2. As an arthritis patient, I want to know if humidity and temperature affect my joint pain so I can discuss environmental factors with my doctor.
3. As a chronic pain patient, I want weather alerts when conditions matching my trigger profile are forecasted so I can take preventive action.
4. As a patient, I want the system to automatically capture weather data whenever I log a symptom so I do not have to manually enter weather conditions.

### Behavior Specification

1. **Setup:** First launch prompts for location permission (required for weather data)
2. **Auto-capture:** When user logs a symptom via the existing symptom logger:
   a. System requests current weather from Open-Meteo API using device location
   b. System saves weather snapshot to `md_weather_snapshots`
   c. System links snapshot to symptom log via `md_weather_symptom_links`
   d. Weather capture is non-blocking (symptom saves immediately, weather fetch is background)
3. **Periodic capture:** System captures weather snapshot every 6 hours (when app is active) to build baseline data for correlation
4. **Correlation dashboard:**
   a. Scatter plot: symptom severity (y-axis) vs barometric pressure (x-axis) with trend line
   b. Factor analysis: ranks weather factors by correlation strength
      - Barometric pressure (absolute + change rate)
      - Temperature
      - Humidity
      - Wind speed
   c. Each factor shows correlation coefficient and "X times more likely on [condition] days"
5. **Trigger profile:** After 30+ symptom logs with weather data:
   a. System identifies the user's top weather triggers
   b. Example: "Your headaches are 2.8x more likely when pressure drops >5mb in 3 hours"
6. **Forecast alerts:** On Today tab:
   a. System checks tomorrow's weather forecast
   b. If forecast matches trigger profile, show alert card: "Pressure drop forecasted tomorrow. Migraine risk may be elevated."

### Edge Cases

- Location permission denied: weather features disabled; show explanation and re-request option
- No network available when logging symptom: log symptom without weather; backfill weather data when connectivity returns (use captured_at timestamp to fetch historical weather)
- Open-Meteo API rate limit (10,000 req/day): more than enough for individual use. No throttling needed.
- User travels to different location: weather auto-updates to current location
- Fewer than 10 weather-linked symptom logs: hide correlation analysis, show "Need more data" with progress bar
- Correlation found but weak (r < 0.2): show "No strong weather correlation detected" rather than misleading weak correlations
- Module disabled: weather capture stops, existing data preserved

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Weather data auto-captured when user logs a symptom
- [ ] **AC-2:** Weather snapshot shows temperature, humidity, barometric pressure, weather description
- [ ] **AC-3:** Correlation dashboard shows scatter plot of symptom severity vs pressure
- [ ] **AC-4:** Factor analysis ranks weather factors by correlation strength
- [ ] **AC-5:** Each factor shows multiplier (e.g., "2.8x more likely")
- [ ] **AC-6:** Trigger profile summary generated after 30+ linked symptom logs
- [ ] **AC-7:** Forecast alert card appears on Today tab when trigger conditions are predicted
- [ ] **AC-8:** Location configuration accessible in Settings (can update location without full re-permission)
- [ ] **AC-9:** Periodic weather capture runs every 6 hours (when app active)
- [ ] **AC-10:** Weather correlation works offline using cached weather data for analysis

### Technical Criteria
- [ ] **TC-1:** `md_weather_snapshots` table created in V4 migration
- [ ] **TC-2:** `md_weather_symptom_links` junction table with unique constraint
- [ ] **TC-3:** Open-Meteo API client fetches current weather and 24-hour forecast
- [ ] **TC-4:** Weather capture is non-blocking (does not delay symptom log save)
- [ ] **TC-5:** Correlation engine computes Pearson coefficient for each weather factor
- [ ] **TC-6:** Multiplier calculation: ratio of symptom frequency on "trigger days" vs "normal days"
- [ ] **TC-7:** Backfill: if weather fetch fails, queue for retry; use Open-Meteo historical endpoint
- [ ] **TC-8:** Weather data fetch completes in <2 seconds

### Negative Criteria
- [ ] **NC-1:** User health data (symptoms, medications) must NEVER be sent to the weather API
- [ ] **NC-2:** Location data must NOT be stored permanently -- only used for weather fetch, then discarded (only lat/lon in weather snapshots for reference)
- [ ] **NC-3:** Correlation results must NOT be presented as medical predictions -- use "may be associated" language
- [ ] **NC-4:** Weather alerts must NOT use push notifications (on-device only, shown when app is opened)
- [ ] **NC-5:** Must NOT capture weather without location permission granted

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Current weather card: glass card with temperature, pressure (with arrow for trend), humidity, weather icon
- Scatter plot: dots colored by symptom severity (light to dark cyan), trend line in white
- Factor analysis: horizontal bar chart, bars colored by correlation strength (gray=none, cyan=moderate, red=strong)
- Trigger profile: glass card with bold multiplier text ("2.8x") and condition description
- Forecast alert: amber/orange glass card on Today tab with warning icon
- Module accent: `#06B6D4` (meds cyan)

### Web (Next.js)
- Route: `/meds/weather`
- Same tokens via CSS variables
- Wider scatter plot with mouse hover for individual data points
- Side panel for factor analysis and trigger profile

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Weather icon spinning + "Fetching weather data..." | API call in progress |
| No permission | "Location access needed for weather correlation" + enable button | Location permission not granted |
| Empty | "Log symptoms with weather data to see correlations" + progress (0/30) | No weather-linked symptom logs |
| Insufficient | Partial dashboard + "Need [N] more entries for trigger analysis" + progress bar | <30 linked logs |
| Error | "Could not fetch weather" + "Analysis uses cached data" | API unreachable |
| Success | Full dashboard with scatter plot, factor analysis, trigger profile, forecast alert | 30+ linked logs |
| No correlation | "No strong weather correlations detected for your symptoms" | Data exists but all correlations weak |

## Test Requirements

### Unit Tests
- [ ] `captureWeatherSnapshot`: creates snapshot with all weather fields from API response
- [ ] `linkWeatherToSymptom`: creates link record, enforces uniqueness
- [ ] `calculateWeatherCorrelation`: computes Pearson coefficient for pressure vs severity
- [ ] `calculateWeatherCorrelation`: returns null with <10 data points
- [ ] `calculateTriggerMultiplier`: returns correct ratio (e.g., 2.8x)
- [ ] `identifyTriggerProfile`: selects top correlated factor with r > 0.3
- [ ] `identifyTriggerProfile`: returns empty when no factor has r > 0.2
- [ ] `shouldShowForecastAlert`: returns true when forecast matches trigger profile
- [ ] `shouldShowForecastAlert`: returns false when no trigger profile exists
- [ ] Weather API client: parses Open-Meteo JSON response correctly
- [ ] Weather API client: handles network error gracefully (returns null, queues backfill)

### Integration Tests
- [ ] Full flow: grant location -> log symptom -> weather auto-captured -> link created
- [ ] Correlation: log 30 symptoms on low-pressure days, 10 on normal days -> pressure shows as trigger
- [ ] Offline: log symptom without network -> symptom saved -> weather backfilled later

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds -> Settings -> Weather Location
3. Grant location permission
4. Verify: location configured successfully -- AC-8
5. Navigate to Today tab
6. Log a symptom (headache, severity 4)
7. Navigate to History -> Correlations -> Weather
8. Verify: weather snapshot captured with temperature, humidity, pressure -- AC-1, AC-2
9. Log 30+ symptoms over multiple days (simulate with varied severity)
10. Navigate to Weather Correlation dashboard
11. Verify: scatter plot shows symptom severity vs pressure -- AC-3
12. Verify: factor analysis ranks weather factors -- AC-4
13. Verify: multiplier shown per factor (e.g., "2.8x more likely") -- AC-5
14. Verify: trigger profile summary generated -- AC-6
15. Verify: forecast alert card appears on Today tab if conditions match -- AC-7
16. Turn off network
17. Navigate to correlation dashboard
18. Verify: analysis still works with cached data -- AC-10
19. Verify: no user health data appears in network logs -- NC-1
20. Repeat key checks on web at `/meds/weather`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/weather`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for weather correlation engine

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has symptom logging and a Pearson correlation engine for mood-medication and symptom-medication correlations, but no weather data capture or weather-symptom analysis.

### After This Work
Weather data is auto-captured with each symptom log (via Open-Meteo API), stored locally, and analyzed for correlations. Users see scatter plots, factor rankings, trigger profiles, and forecast-based risk alerts. All health data stays on-device; only public weather data is fetched.

### Files Changed
- `modules/meds/src/weather/engine.ts` -- Correlation analysis, trigger identification, alert generation
- `modules/meds/src/weather/api.ts` -- Open-Meteo API client
- `modules/meds/src/weather/__tests__/engine.test.ts` -- Engine tests with mocked API
- `modules/meds/src/db/weather.ts` -- CRUD for weather snapshots and links
- `modules/meds/src/db/schema.ts` -- V4 tables
- `modules/meds/src/models/weather.ts` -- Zod schemas
- `modules/meds/src/models/index.ts` -- Re-export weather models
- `modules/meds/src/definition.ts` -- V4 migration, add weather screen
- `modules/meds/src/index.ts` -- Export weather engine + types
- `apps/mobile/app/(meds)/weather.tsx` -- Weather correlation dashboard
- `apps/web/app/meds/weather/page.tsx` -- Web weather dashboard

### Known Limitations
- Open-Meteo free tier is generous (10,000 req/day) but has no SLA. If the API is down, weather capture queues for backfill.
- Weather capture requires the app to be active (no background fetch on iOS without complex background task setup). Periodic 6-hour captures happen only when the app is open.
- Correlation analysis is observational, not causal. The 2-24 hour window for symptom-weather linking is a heuristic.
- Only current-location weather is captured. Users who travel frequently may have noisy location data.

### Context for Next Agent
- Open-Meteo API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code`. No API key needed. Response is JSON.
- The existing correlation engine in `analytics/correlation.ts` re-exports from `@mylife/intelligence`. The weather correlation engine should be a new, separate module in `weather/engine.ts` that follows the same Pearson coefficient pattern.
- `expo-location` provides `Location.getCurrentPositionAsync()` for coordinates. Request `Location.Accuracy.Balanced` (not high accuracy -- weather does not need GPS precision).
- V4 migration: coordinate with other B+C feature tables in the same migration version.
