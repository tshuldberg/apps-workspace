# MySurf — Design Document

**Date:** 2026-02-21
**Author:** Trey Shuldberg
**Status:** Approved
**Repository:** github.com/tshuldberg/MySurf

---

## 1. Product Vision

**MySurf** — The surf forecast app that doesn't lie.

A full-stack surf forecasting platform (iOS + Android + Web) competing with Surfline. Combines Windy's interactive swell map visualization with spot-level intelligence, AI-generated forecaster narratives, and community-driven spot discovery.

### Core Differentiators vs Surfline

1. **Interactive swell map** — Tap anywhere on the California coast, not just curated spots. See raw model data overlaid on the coastline (Windy-style).
2. **Better model transparency** — WaveWatch III data transformed through spot-specific bathymetry/orientation parameters. Users can see and verify the raw data behind every rating.
3. **AI-generated narratives** — LLM-powered forecaster reports for every spot, not just the 30 regions Surfline covers. Scales infinitely at near-zero cost.
4. **Community spot discovery** — Users pin and name spots. Community validates over time. The database grows organically and surpasses Surfline's curated list.
5. **$5/year pricing** — 95% cheaper than Surfline Premium ($99.99/yr). Removes the paywall barrier entirely.

### Target User

California surfers who check Surfline but don't trust it ("Surf Lie"), and intermediate+ surfers who want raw data alongside user-friendly ratings. Primary persona: surfer who checks conditions daily, knows what swell direction/period means, but wants it presented clearly.

### MVP Scope

- California coastline only (expand later)
- ~200 curated surf spots (seeded)
- Tap-anywhere model data on the swell map
- 7-day forecast (free) / 16-day forecast (paid)
- AI-generated narratives per spot
- Community spot creation + pinning
- No surf cams (skip for MVP — Surfline's infrastructure moat)
- No live video streaming

### Monetization

- **Free tier:** Basic forecasts, swell map, spot ratings, 7-day forecast
- **Premium ($5/year):** 16-day forecast, advanced swell data, historical data, ad-free, priority AI narratives

---

## 2. Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Backend:** Supabase (PostgreSQL + PostGIS, Edge Functions, Auth, Realtime, Storage)
- **Data Pipeline:** TypeScript worker service for NOAA data ingestion
- **AI Narratives:** Claude API (Anthropic)
- **Maps (Mobile):** @rnmapbox/maps (Mapbox GL Native)
- **Maps (Web):** MapLibre GL JS
- **Monorepo:** Turborepo
- **Package Manager:** Bun
- **Language:** TypeScript everywhere

### Monorepo Structure

```
MySurf/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   └── assets/            # Icons, images, fonts
│   ├── web/                   # Next.js 15 — Web app
│   │   ├── app/               # App Router (file-based routing)
│   │   ├── components/        # Web-specific components
│   │   └── public/            # Static assets
│   └── data-pipeline/         # NOAA/NDBC data ingestion service
│       ├── src/
│       │   ├── ingestors/     # GRIB2 parser, buoy fetcher, tide fetcher
│       │   ├── processors/    # Forecast computation, tile generation
│       │   ├── generators/    # AI narrative generation
│       │   └── schedulers/    # Cron job definitions
│       └── package.json
├── packages/
│   ├── shared/                # Types, utils, forecast model, business logic
│   │   ├── src/
│   │   │   ├── types/         # Spot, Forecast, Swell, Tide, User types
│   │   │   ├── models/        # Rating algorithm, energy computation
│   │   │   ├── utils/         # Date helpers, unit conversion, geo utils
│   │   │   └── constants/     # Swell directions, color scales, spot categories
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── charts/        # Tide chart, swell bar chart, wind chart, energy chart
│   │   │   ├── cards/         # Spot card, forecast card, narrative card
│   │   │   ├── indicators/    # Condition dots, rating badges, swell arrows
│   │   │   └── layout/        # Tab bar, headers, modals
│   │   └── package.json
│   ├── api/                   # Supabase client, typed queries, API layer
│   │   ├── src/
│   │   │   ├── client.ts      # Supabase client initialization
│   │   │   ├── queries/       # Typed query functions per table
│   │   │   ├── subscriptions/ # Realtime subscription helpers
│   │   │   └── types.ts       # Generated Supabase types
│   │   └── package.json
│   └── maps/                  # Map configuration, tile layers, spot rendering
│       ├── src/
│       │   ├── layers/        # Swell overlay, spot markers, wind arrows
│       │   ├── tiles/         # Tile URL generation, caching
│       │   └── config.ts      # Map styles, bounds, zoom levels
│       └── package.json
├── supabase/
│   ├── migrations/            # PostgreSQL + PostGIS schema migrations
│   ├── functions/             # Edge Functions (TypeScript)
│   │   ├── compute-forecast/  # Forecast computation
│   │   ├── generate-narrative/# AI narrative generation
│   │   └── ingest-data/       # Data ingestion triggers
│   ├── seed/                  # California spot seed data
│   │   └── california-spots.sql
│   └── config.toml
├── turbo.json
├── package.json
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Database Schema (PostgreSQL + PostGIS)

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Surf spots (curated + community-created)
CREATE TABLE spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    orientation_degrees SMALLINT NOT NULL,        -- Beach facing direction (0-360)
    spot_type TEXT NOT NULL DEFAULT 'beach_break', -- beach_break, point_break, reef_break
    ideal_swell_dir_min SMALLINT,
    ideal_swell_dir_max SMALLINT,
    ideal_tide_low NUMERIC(3,1),
    ideal_tide_high NUMERIC(3,1),
    skill_level TEXT DEFAULT 'all',               -- beginner, intermediate, advanced, all
    is_curated BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    region TEXT NOT NULL,                          -- e.g., 'santa_barbara', 'ventura', 'la_south_bay'
    description TEXT,
    crowd_factor SMALLINT,                        -- 1-5
    hazards TEXT[],                                -- ['rocks', 'rip_currents', 'sharks', 'localism']
    photos TEXT[],                                 -- Supabase Storage URLs
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX spots_location_idx ON spots USING GIST(location);
CREATE INDEX spots_region_idx ON spots(region);

-- Swell components (multiple per forecast hour)
CREATE TABLE swell_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_id UUID NOT NULL,
    height_ft NUMERIC(4,1) NOT NULL,
    period_seconds SMALLINT NOT NULL,
    direction_degrees SMALLINT NOT NULL,
    direction_label TEXT NOT NULL,                -- 'NW', 'WNW', 'SSE', etc.
    component_order SMALLINT NOT NULL DEFAULT 1   -- primary=1, secondary=2, tertiary=3
);

-- Hourly forecasts per spot
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    forecast_time TIMESTAMPTZ NOT NULL,
    wave_height_min_ft NUMERIC(4,1),
    wave_height_max_ft NUMERIC(4,1),
    wave_height_label TEXT,                       -- 'Shin to knee', 'Waist to chest', etc.
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    condition_color TEXT NOT NULL,                 -- 'red', 'orange', 'yellow', 'green', 'teal'
    wind_speed_kts NUMERIC(4,1),
    wind_gust_kts NUMERIC(4,1),
    wind_direction_degrees SMALLINT,
    wind_label TEXT,                               -- 'offshore', 'cross-shore', 'onshore'
    energy_kj NUMERIC(8,1),
    consistency_score SMALLINT CHECK (consistency_score BETWEEN 0 AND 100),
    water_temp_f NUMERIC(4,1),
    air_temp_f NUMERIC(4,1),
    model_run TIMESTAMPTZ NOT NULL,               -- Which WW3 model run this came from
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(spot_id, forecast_time, model_run)
);

CREATE INDEX forecasts_spot_time_idx ON forecasts(spot_id, forecast_time);

-- Tide predictions
CREATE TABLE tides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id TEXT NOT NULL,
    station_name TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    height_ft NUMERIC(4,1) NOT NULL,
    type TEXT NOT NULL,                           -- 'high', 'low', 'intermediate'
    UNIQUE(station_id, timestamp)
);

-- Real-time buoy readings
CREATE TABLE buoy_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buoy_id TEXT NOT NULL,                        -- NDBC station ID (e.g., '46053')
    buoy_name TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    wave_height_ft NUMERIC(4,1),
    dominant_period_seconds SMALLINT,
    average_period_seconds SMALLINT,
    wave_direction_degrees SMALLINT,
    water_temp_f NUMERIC(4,1),
    air_temp_f NUMERIC(4,1),
    wind_speed_kts NUMERIC(4,1),
    wind_direction_degrees SMALLINT,
    UNIQUE(buoy_id, timestamp)
);

-- AI-generated forecast narratives
CREATE TABLE narratives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id UUID REFERENCES spots(id) ON DELETE CASCADE,
    region TEXT,                                   -- Can be region-level or spot-level
    forecast_date DATE NOT NULL,
    summary TEXT NOT NULL,                         -- Bold headline text
    body TEXT NOT NULL,                            -- Full narrative
    generated_at TIMESTAMPTZ DEFAULT now(),
    model_version TEXT DEFAULT 'v1',
    helpful_votes INT DEFAULT 0,
    unhelpful_votes INT DEFAULT 0
);

-- User favorites
CREATE TABLE user_favorites (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    position SMALLINT DEFAULT 0,                  -- Sort order
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, spot_id)
);

-- User-pinned custom spots
CREATE TABLE user_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX user_pins_location_idx ON user_pins USING GIST(location);

-- Surf sessions (personal tracking)
CREATE TABLE surf_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    spot_id UUID REFERENCES spots(id),
    session_date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    notes TEXT,
    photos TEXT[],
    conditions_snapshot JSONB,                    -- Snapshot of conditions at session time
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',            -- 'free', 'premium'
    price_cents INT,
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    platform TEXT,                                -- 'ios', 'android', 'web'
    store_transaction_id TEXT
);
```

### Spot Rating Algorithm

```typescript
// packages/shared/src/models/rating.ts

interface SpotProfile {
  orientationDegrees: number      // Beach facing direction
  idealSwellDirMin: number
  idealSwellDirMax: number
  idealTideLow: number
  idealTideHigh: number
  spotType: 'beach_break' | 'point_break' | 'reef_break'
}

interface ForecastData {
  swellComponents: SwellComponent[]
  windSpeedKts: number
  windDirectionDegrees: number
  tideHeightFt: number
  consistency: number             // 0-1 from model
}

interface SwellComponent {
  heightFt: number
  periodSeconds: number
  directionDegrees: number
}

function computeSpotRating(spot: SpotProfile, forecast: ForecastData): Rating {
  // Score each swell component against spot's ideal orientation
  const swellScore = forecast.swellComponents.reduce((score, swell, i) => {
    const directionFit = computeDirectionFit(
      swell.directionDegrees,
      spot.idealSwellDirMin,
      spot.idealSwellDirMax,
      spot.orientationDegrees
    )
    const sizeFactor = Math.min(swell.heightFt / 3, 1)  // Normalize to 3ft
    const periodBonus = swell.periodSeconds > 12 ? 0.15 : 0 // Long period = cleaner waves
    const weight = i === 0 ? 0.7 : i === 1 ? 0.2 : 0.1  // Primary swell matters most
    return score + (directionFit * sizeFactor + periodBonus) * weight
  }, 0)

  // Wind: offshore = 1.0, cross = 0.5, onshore = 0.0
  const windAngle = angleDifference(forecast.windDirectionDegrees, spot.orientationDegrees)
  const windScore = forecast.windSpeedKts < 5
    ? 0.9  // Light wind is always good
    : windAngle > 135 ? 1.0   // Offshore
    : windAngle > 80  ? 0.5   // Cross-shore
    : windAngle > 45  ? 0.3   // Cross-onshore
    : 0.1                      // Onshore

  // Tide: within ideal range = 1.0, outside = penalty
  const tideScore = forecast.tideHeightFt >= spot.idealTideLow
    && forecast.tideHeightFt <= spot.idealTideHigh ? 1.0 : 0.5

  // Consistency: direct from model
  const consistencyScore = forecast.consistency

  // Weighted combination
  const raw = swellScore * 0.45 + windScore * 0.25 + tideScore * 0.15 + consistencyScore * 0.15
  const stars = Math.max(1, Math.min(5, Math.round(raw * 5)))

  return {
    stars,
    color: starsToColor(stars),
    energy: computeEnergy(forecast.swellComponents),
    consistency: Math.round(forecast.consistency * 100)
  }
}

function starsToColor(stars: number): ConditionColor {
  if (stars <= 1) return 'red'
  if (stars <= 2) return 'orange'
  if (stars <= 3) return 'yellow'
  if (stars <= 4) return 'green'
  return 'teal'
}

function computeEnergy(swells: SwellComponent[]): number {
  // Wave energy: E = ρgH²T/16 (simplified)
  const rhoG = 1025 * 9.81  // seawater density * gravity
  return swells.reduce((total, s) => {
    return total + (rhoG * Math.pow(s.heightFt * 0.3048, 2) * s.periodSeconds) / 16
  }, 0) / 1000  // Convert to kJ
}
```

---

## 3. UI Screens

### Navigation (Bottom Tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Home | ◉ | Personalized feed with AI narratives + spot forecasts |
| Map | 📍 | Interactive swell map (Windy-style) — key differentiator |
| Sessions | ↻ | Personal surf session log |
| Favorites | ≡ | Saved spots list |
| Account | 👤 | Profile, settings, subscription |

### 3.1 Home Screen

**Layout:**
- Greeting: "Good afternoon, {name}" with + (add spot) and 🔍 (search) icons
- Regional AI narrative card: multi-day summary text (Sat/Mon/Tue format)
- Day selector: horizontal scroll (Sat 21, Sun 22, Mon 23...) with favorite stars
- Spot forecast cards: vertical scroll list
  - Spot name
  - Wave height range (e.g., "1-2")
  - Condition color bar (5 dots: red/orange/yellow/green/teal)
  - Swell direction arrows

**Dark theme** throughout (matches screenshots — dark background, white text, muted cards)

### 3.2 Swell Map Screen

**Layout:**
- Full-screen map with swell overlay (color-coded wave height heatmap)
- Floating controls: Home, Search, Pin, Favorites, Menu (right side)
- Time scrubber at bottom: current time indicator, day labels, play button
- Wave height scale legend: ft (1.6, 3.3, 5, 6.6, 20, 30)
- Spot markers: circles colored by current condition
- Tap coastline → popup: "Model estimate: 2.5ft @ 14s from NW" + "Pin this spot" button
- Close button (X) to dismiss overlays

### 3.3 Spot Detail Screen

**Header:** Back arrow, Spot name, + button (add to favorites)

**Tab Bar:** Live | Forecast | Analysis | Charts | Guide

**Forecast Tab:**
- 16-day forecast: horizontal scroll cards
  - Day/date, star favorite, wave height range, swell arrows, condition bar
  - "Historic data" button
- Graph/Table toggle
- AI forecaster report card (avatar, name="MySurf AI", region, time ago)
  - Bold summary + body text
  - Share + expand buttons
- Rating badge (POOR/FAIR/GOOD/GREAT/EPIC with color)

**Detailed Forecast (scroll down):**
- Hourly rating bar (color gradient, 3am-9pm with current time marker)
- SURF section:
  - Height range + label ("0-1ft, Shin to knee")
  - Swell component table (height, period, direction for each)
  - Hourly surf bar chart with color-coded conditions
  - "Advanced Swell" link
- WIND section:
  - Speed + gust (kts), direction label ("W, cross-shore")
  - Aerial photo with wind arrow overlay
  - Hourly wind bar chart with direction arrows
- TIDE section:
  - Tide curve chart with high/low times + heights
  - Sunrise/sunset + first light/last light
  - Location reference + "Tide calendar" link
- ENERGY card:
  - Value in kJ, hourly bar chart (3am-9pm)
- CONSISTENCY card:
  - Score out of 100, hourly area chart (High/Low scale)

**Analysis Tab:**
- Forecaster profile header (AI-generated persona)
- Daily narrative cards:
  - Day label + timestamp
  - Bold summary line
  - Full narrative text
  - Share button
  - "Was this forecast useful?" + thumbs up/down

**Charts Tab:**
- Historical swell height over time
- Buoy readings trend
- Wind pattern charts
- Interactive, zoomable

**Guide Tab:**
- Best conditions: ideal swell direction, ideal tide, best wind
- Skill level indicator
- Crowd factor
- Hazards list
- Community notes
- Spot photos

### 3.4 Sessions Screen

- List of personal surf sessions (date, spot, rating, photo thumbnail)
- "Log a session" floating button
- Session detail: date, spot, start/end time, personal rating, notes, photos, conditions snapshot

### 3.5 Favorites Screen

- Reorderable list of favorited spots
- Each shows current condition summary (height, color, wind)
- Includes user-pinned custom spots

### 3.6 Account Screen

- Profile info (name, photo, home region)
- Subscription status (Free / Premium)
- Notification settings (daily forecast, swell alerts, session reminders)
- Units preference (ft/m, °F/°C, kts/mph)
- About, Support, Legal

---

## 4. Data Sources (Free/Open)

| Source | Data | Frequency | Cost |
|--------|------|-----------|------|
| NOAA WaveWatch III | Global wave model (GRIB2) | 4x/day | Free |
| NDBC | Real-time buoy readings | Every 30 min | Free |
| NOAA CO-OPS | Tide predictions | Daily | Free |
| Open-Meteo | Wind, air temp, UV | Hourly | Free |
| USGS | Coastline geometry | Static | Free |
| Claude API | AI narrative generation | On-demand | ~$0.01/narrative |

---

## 5. AI Narrative Pipeline

### Input (per region, every 6 hours)
```json
{
  "region": "santa_barbara",
  "spots": [
    {
      "name": "Rincon (The Cove)",
      "forecast": { "waveHeight": "0-1ft", "swellDir": "WNW", "period": "12s", "wind": "7kts W" },
      "rating": 2
    }
  ],
  "buoy_readings": { "46053": { "height": "1.1ft", "period": "7s", "dir": "W 272°" } },
  "tide_summary": "High 3.0ft at 1:10pm, Low 0.6ft at 7:13am",
  "wind_summary": "Light W winds 1-7kts, cross-shore. Light all day."
}
```

### Prompt Template
```
You are a local surf forecaster for the {region} area. Write a concise, conversational
forecast for {date}. Use natural surfer language. Be direct and honest about conditions.

Data: {forecast_data}

Style examples:
- "Smaller leftover NW swell mix today. Morning conditions are nicer than we had during the week."
- "Another day of light wind and clean conditions. Surf bottoms out, though."
- "Looking like a good day to get back in the water after all the weather as new WNW swell shows."

Write a 2-3 sentence bold summary, then 2-3 sentences of detail. Include board recommendations
if conditions warrant it (e.g., "One for the big boards and/or small humans").
```

### Output → `narratives` table
```json
{
  "summary": "Small leftover NW swell mix today, but conditions get better than they were during the week.",
  "body": "Getting pretty small today as the NW energy from earlier in the week is down to minor leftovers. On the bright side, the winds will be pretty light all day — especially for the morning tide push. Mid day SSE onshores top out at light+.\n\nOne for the big boards and/or small humans. If you sat out the wind and rain all week, you'll probably be coming back to chillier waters."
}
```

---

## 6. Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#FFFFFF',
    textSecondary: '#999999',
    textTertiary: '#666666',
    accent: '#3B82F6',          // Blue
    conditionRed: '#EF4444',
    conditionOrange: '#F97316',
    conditionYellow: '#EAB308',
    conditionGreen: '#22C55E',
    conditionTeal: '#14B8A6',
    chartLine: '#60A5FA',
    chartBar: '#3B82F6',
    chartBarLight: '#1E3A5F',
    tabActive: '#FFFFFF',
    tabInactive: '#666666',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16 },
  typography: {
    greeting: { fontSize: 24, fontWeight: '700' },
    spotName: { fontSize: 18, fontWeight: '600' },
    waveHeight: { fontSize: 16, fontWeight: '600' },
    narrative: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
    narrativeBold: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
    label: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    metric: { fontSize: 32, fontWeight: '700' },
    metricUnit: { fontSize: 16, fontWeight: '400' },
  }
}
```

---

## 7. MVP Feature Priority

### P0 — Must Have (Launch)
- [ ] Interactive swell map with time scrubber
- [ ] Spot list with condition ratings (200 CA spots seeded)
- [ ] 7-day spot forecast (hourly surf, wind, tide charts)
- [ ] AI-generated narratives per region
- [ ] User accounts + favorites
- [ ] Tap-anywhere coastline model data
- [ ] Dark theme throughout
- [ ] iOS + Android (Expo)

### P1 — Should Have (Week 2-3)
- [ ] Community spot creation + pinning
- [ ] 16-day forecast (premium)
- [ ] Session logging
- [ ] Push notifications (daily forecast, swell alerts)
- [ ] Web app (Next.js)

### P2 — Nice to Have (Month 2+)
- [ ] Historical data charts
- [ ] Advanced swell analysis (component breakdown, energy spectrum)
- [ ] Premium subscription ($5/year) via IAP
- [ ] Spot Guide tab (community notes, hazards, best conditions)
- [ ] Social features (share forecasts, session photos)

### P3 — Future
- [ ] Expand to US West Coast (OR, WA)
- [ ] Expand to Hawaii, East Coast
- [ ] ECMWF model integration (premium accuracy tier)
- [ ] ML model improvement from user feedback loop
- [ ] Community webcam integration
- [ ] Global expansion

---

## 8. Non-Functional Requirements

- **Performance:** Map loads in < 2s, forecast data in < 1s
- **Offline:** Cache last-fetched forecasts for offline viewing
- **Accessibility:** VoiceOver/TalkBack support, minimum contrast ratios
- **Data freshness:** Forecasts update 4x/day, buoy readings every 30 min
- **Privacy:** No location tracking beyond user-set home region. Minimal data collection.
- **App size:** Target < 50MB (no bundled map tiles — stream from CDN)

---

## 9. Competitive Analysis Summary

| Feature | Surfline | Windy | MySurf |
|---------|----------|-------|--------|
| Spot forecasts | ✅ 5000+ spots | ❌ No spots | ✅ 200+ CA (growing) |
| Interactive swell map | ❌ | ✅ Excellent | ✅ Windy-style |
| Tap-anywhere data | ❌ | ✅ | ✅ + spot context |
| Forecast accuracy | ⚠️ "Surf Lie" | ✅ Raw model | ✅ Spot-tuned model |
| Human narratives | ✅ Paid forecasters | ❌ | ✅ AI-generated |
| Surf cams | ✅ Expensive moat | ❌ | ❌ (skip MVP) |
| Price | $99.99/yr premium | Free | $5/yr premium |
| Community spots | ❌ | ❌ | ✅ |
| Session tracking | ✅ (Premium) | ❌ | ✅ (Free) |
