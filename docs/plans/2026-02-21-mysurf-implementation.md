# MySurf Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack surf forecasting platform (iOS + Android + Web) that combines interactive swell maps, spot-level intelligence, AI-generated narratives, and community spot discovery — competing with Surfline.

**Architecture:** Turborepo monorepo with Expo (React Native) for mobile, Next.js 15 for web, and Supabase (PostgreSQL + PostGIS) for backend. Shared TypeScript packages for types, UI components, API client, and map configuration. Data pipeline ingests NOAA WaveWatch III, NDBC buoy readings, and NOAA tide data. Claude API generates natural-language surf narratives.

**Tech Stack:** TypeScript, Expo (React Native), Next.js 15, Supabase (PostgreSQL + PostGIS + Edge Functions + Auth + Realtime), Mapbox GL (@rnmapbox/maps for mobile, MapLibre GL JS for web), Turborepo, Bun, Claude API, Zod, React Navigation (Expo Router)

**Design Document:** `docs/plans/2026-02-21-mysurf-design.md`

**Repository:** `github.com/tshuldberg/MySurf`

---

## Phase 0: Monorepo Scaffold & Tooling

> Sets up the project structure, package manager, TypeScript config, and CI. Every subsequent phase builds on this foundation.

### Task 0.1: Initialize Turborepo Monorepo

**Files:**
- Create: `MySurf/package.json`
- Create: `MySurf/turbo.json`
- Create: `MySurf/tsconfig.base.json`
- Create: `MySurf/.npmrc`
- Modify: `MySurf/.gitignore` (already exists)

**Step 1: Create root package.json**

```json
{
  "name": "mysurf",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "dev:mobile": "turbo dev --filter=@mysurf/mobile",
    "dev:web": "turbo dev --filter=@mysurf/web",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.4",
    "typescript": "^5.7"
  },
  "packageManager": "bun@1.2.4"
}
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Step 4: Install dependencies**

Run: `cd /Users/trey/Desktop/Apps/MySurf && bun install`
Expected: Creates `bun.lockb`, `node_modules/`

**Step 5: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .npmrc .gitignore
git commit -m "chore: initialize turborepo monorepo with bun"
```

---

### Task 0.2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/spot.ts`
- Create: `packages/shared/src/types/forecast.ts`
- Create: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/types/index.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@mysurf/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.0"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create core type definitions**

`packages/shared/src/types/spot.ts`:
```typescript
import { z } from 'zod'

export const SpotTypeSchema = z.enum(['beach_break', 'point_break', 'reef_break'])
export type SpotType = z.infer<typeof SpotTypeSchema>

export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'all'])
export type SkillLevel = z.infer<typeof SkillLevelSchema>

export const HazardSchema = z.enum([
  'rocks', 'rip_currents', 'sharks', 'localism', 'shallow_reef',
  'strong_currents', 'shore_break', 'jellyfish', 'pollution'
])
export type Hazard = z.infer<typeof HazardSchema>

export const SpotSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  orientationDegrees: z.number().min(0).max(360),
  spotType: SpotTypeSchema,
  idealSwellDirMin: z.number().min(0).max(360).optional(),
  idealSwellDirMax: z.number().min(0).max(360).optional(),
  idealTideLow: z.number().optional(),
  idealTideHigh: z.number().optional(),
  skillLevel: SkillLevelSchema,
  isCurated: z.boolean(),
  createdBy: z.string().uuid().optional(),
  region: z.string().min(1),
  description: z.string().optional(),
  crowdFactor: z.number().min(1).max(5).optional(),
  hazards: z.array(HazardSchema),
  photos: z.array(z.string().url()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Spot = z.infer<typeof SpotSchema>

export const RegionSchema = z.enum([
  'humboldt', 'mendocino', 'san_francisco', 'santa_cruz',
  'monterey', 'san_luis_obispo', 'santa_barbara', 'ventura',
  'la_north', 'la_south_bay', 'orange_county', 'san_diego_north',
  'san_diego_south'
])
export type Region = z.infer<typeof RegionSchema>
```

`packages/shared/src/types/forecast.ts`:
```typescript
import { z } from 'zod'

export const ConditionColorSchema = z.enum(['red', 'orange', 'yellow', 'green', 'teal'])
export type ConditionColor = z.infer<typeof ConditionColorSchema>

export const WindLabelSchema = z.enum(['offshore', 'cross-shore', 'onshore', 'light'])
export type WindLabel = z.infer<typeof WindLabelSchema>

export const SwellComponentSchema = z.object({
  heightFt: z.number().min(0),
  periodSeconds: z.number().min(0),
  directionDegrees: z.number().min(0).max(360),
  directionLabel: z.string(), // 'NW', 'WNW', 'SSE', etc.
  componentOrder: z.number().min(1).max(3),
})
export type SwellComponent = z.infer<typeof SwellComponentSchema>

export const ForecastSchema = z.object({
  id: z.string().uuid(),
  spotId: z.string().uuid(),
  forecastTime: z.string().datetime(),
  waveHeightMinFt: z.number().min(0),
  waveHeightMaxFt: z.number().min(0),
  waveHeightLabel: z.string().optional(), // 'Shin to knee', 'Waist to chest'
  rating: z.number().min(1).max(5),
  conditionColor: ConditionColorSchema,
  swellComponents: z.array(SwellComponentSchema),
  windSpeedKts: z.number().min(0),
  windGustKts: z.number().min(0),
  windDirectionDegrees: z.number().min(0).max(360),
  windLabel: WindLabelSchema,
  energyKj: z.number().min(0),
  consistencyScore: z.number().min(0).max(100),
  waterTempF: z.number().optional(),
  airTempF: z.number().optional(),
  modelRun: z.string().datetime(),
})
export type Forecast = z.infer<typeof ForecastSchema>

export const TidePointSchema = z.object({
  timestamp: z.string().datetime(),
  heightFt: z.number(),
  type: z.enum(['high', 'low', 'intermediate']),
})
export type TidePoint = z.infer<typeof TidePointSchema>

export const NarrativeSchema = z.object({
  id: z.string().uuid(),
  spotId: z.string().uuid().optional(),
  region: z.string().optional(),
  forecastDate: z.string(), // YYYY-MM-DD
  summary: z.string(), // Bold headline
  body: z.string(), // Full narrative
  generatedAt: z.string().datetime(),
  helpfulVotes: z.number().default(0),
  unhelpfulVotes: z.number().default(0),
})
export type Narrative = z.infer<typeof NarrativeSchema>

export const BuoyReadingSchema = z.object({
  buoyId: z.string(),
  buoyName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timestamp: z.string().datetime(),
  waveHeightFt: z.number().optional(),
  dominantPeriodSeconds: z.number().optional(),
  averagePeriodSeconds: z.number().optional(),
  waveDirectionDegrees: z.number().optional(),
  waterTempF: z.number().optional(),
  airTempF: z.number().optional(),
  windSpeedKts: z.number().optional(),
  windDirectionDegrees: z.number().optional(),
})
export type BuoyReading = z.infer<typeof BuoyReadingSchema>

export const SunTimesSchema = z.object({
  firstLight: z.string(), // HH:mm
  sunrise: z.string(),
  sunset: z.string(),
  lastLight: z.string(),
})
export type SunTimes = z.infer<typeof SunTimesSchema>
```

`packages/shared/src/types/user.ts`:
```typescript
import { z } from 'zod'

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  homeRegion: z.string().optional(),
  preferredUnits: z.object({
    wave: z.enum(['ft', 'm']).default('ft'),
    wind: z.enum(['kts', 'mph', 'kmh']).default('kts'),
    temp: z.enum(['F', 'C']).default('F'),
  }),
  plan: z.enum(['free', 'premium']).default('free'),
})
export type UserProfile = z.infer<typeof UserProfileSchema>

export const SurfSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  spotId: z.string().uuid().optional(),
  sessionDate: z.string(), // YYYY-MM-DD
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  photos: z.array(z.string().url()),
  conditionsSnapshot: z.record(z.unknown()).optional(),
})
export type SurfSession = z.infer<typeof SurfSessionSchema>

export const UserPinSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().min(1),
  notes: z.string().optional(),
  isPublic: z.boolean().default(false),
})
export type UserPin = z.infer<typeof UserPinSchema>
```

`packages/shared/src/types/index.ts`:
```typescript
export * from './spot'
export * from './forecast'
export * from './user'
```

`packages/shared/src/index.ts`:
```typescript
export * from './types'
```

**Step 4: Install and typecheck**

Run: `cd /Users/trey/Desktop/Apps/MySurf && bun install && cd packages/shared && bun run typecheck`
Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared package with core type definitions (Spot, Forecast, User)"
```

---

### Task 0.3: Create API Client Package

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/client.ts`
- Create: `packages/api/src/queries/spots.ts`
- Create: `packages/api/src/queries/forecasts.ts`
- Create: `packages/api/src/queries/index.ts`

**Step 1: Create packages/api/package.json**

```json
{
  "name": "@mysurf/api",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49",
    "@mysurf/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create packages/api/src/client.ts**

```typescript
import { createClient } from '@supabase/supabase-js'

// These will be provided by each app's environment
let supabaseUrl = ''
let supabaseAnonKey = ''

export function initSupabase(url: string, anonKey: string) {
  supabaseUrl = url
  supabaseAnonKey = anonKey
}

export function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not initialized. Call initSupabase() first.')
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}
```

**Step 3: Create query functions**

`packages/api/src/queries/spots.ts`:
```typescript
import { getSupabase } from '../client'
import type { Spot, Region } from '@mysurf/shared'

export async function getSpotsByRegion(region: Region): Promise<Spot[]> {
  const { data, error } = await getSupabase()
    .from('spots')
    .select('*')
    .eq('region', region)
    .order('name')

  if (error) throw error
  return data as Spot[]
}

export async function getSpotBySlug(slug: string): Promise<Spot | null> {
  const { data, error } = await getSupabase()
    .from('spots')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Spot | null
}

export async function getNearbySpots(lat: number, lng: number, radiusKm: number = 50): Promise<Spot[]> {
  const { data, error } = await getSupabase()
    .rpc('nearby_spots', { lat, lng, radius_km: radiusKm })

  if (error) throw error
  return data as Spot[]
}

export async function getUserFavoriteSpots(userId: string): Promise<Spot[]> {
  const { data, error } = await getSupabase()
    .from('user_favorites')
    .select('spots(*)')
    .eq('user_id', userId)
    .order('position')

  if (error) throw error
  return (data ?? []).map((row: any) => row.spots as Spot)
}
```

`packages/api/src/queries/forecasts.ts`:
```typescript
import { getSupabase } from '../client'
import type { Forecast, Narrative, TidePoint } from '@mysurf/shared'

export async function getSpotForecast(spotId: string, days: number = 7): Promise<Forecast[]> {
  const now = new Date().toISOString()
  const end = new Date(Date.now() + days * 86400000).toISOString()

  const { data, error } = await getSupabase()
    .from('forecasts')
    .select('*, swell_components(*)')
    .eq('spot_id', spotId)
    .gte('forecast_time', now)
    .lte('forecast_time', end)
    .order('forecast_time')

  if (error) throw error
  return data as Forecast[]
}

export async function getSpotNarrative(spotId: string, date: string): Promise<Narrative | null> {
  const { data, error } = await getSupabase()
    .from('narratives')
    .select('*')
    .eq('spot_id', spotId)
    .eq('forecast_date', date)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Narrative | null
}

export async function getRegionNarrative(region: string, date: string): Promise<Narrative | null> {
  const { data, error } = await getSupabase()
    .from('narratives')
    .select('*')
    .eq('region', region)
    .eq('forecast_date', date)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as Narrative | null
}

export async function getTides(stationId: string, startDate: string, endDate: string): Promise<TidePoint[]> {
  const { data, error } = await getSupabase()
    .from('tides')
    .select('*')
    .eq('station_id', stationId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp')

  if (error) throw error
  return data as TidePoint[]
}
```

`packages/api/src/queries/index.ts`:
```typescript
export * from './spots'
export * from './forecasts'
```

`packages/api/src/index.ts`:
```typescript
export { initSupabase, getSupabase } from './client'
export * from './queries'
```

**Step 4: Install and typecheck**

Run: `cd /Users/trey/Desktop/Apps/MySurf && bun install && cd packages/api && bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/
git commit -m "feat: add API client package with Supabase queries (spots, forecasts, tides)"
```

---

### Task 0.4: Create UI Component Package (Skeleton)

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/theme.ts`

**Step 1: Create packages/ui/package.json**

```json
{
  "name": "@mysurf/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mysurf/shared": "workspace:*",
    "react": "^18.3",
    "react-native": "^0.76"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@types/react": "^18.3"
  }
}
```

**Step 2: Create theme file**

`packages/ui/src/theme.ts`:
```typescript
export const colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  surfaceBorder: '#333333',
  text: '#FFFFFF',
  textSecondary: '#999999',
  textTertiary: '#666666',
  accent: '#3B82F6',
  conditionRed: '#EF4444',
  conditionOrange: '#F97316',
  conditionYellow: '#EAB308',
  conditionGreen: '#22C55E',
  conditionTeal: '#14B8A6',
  chartLine: '#60A5FA',
  chartBar: '#3B82F6',
  chartBarLight: '#1E3A5F',
  chartBarDark: '#0F1A2E',
  tabActive: '#FFFFFF',
  tabInactive: '#666666',
  error: '#EF4444',
  warning: '#F97316',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const

export const typography = {
  greeting: { fontSize: 24, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '700' as const },
  spotName: { fontSize: 18, fontWeight: '600' as const },
  waveHeight: { fontSize: 16, fontWeight: '600' as const },
  narrative: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  narrativeBold: { fontSize: 15, fontWeight: '700' as const, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: '500' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  metric: { fontSize: 32, fontWeight: '700' as const },
  metricUnit: { fontSize: 16, fontWeight: '400' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const },
  tabLabel: { fontSize: 10, fontWeight: '500' as const },
} as const

export function conditionColorToHex(color: string): string {
  const map: Record<string, string> = {
    red: colors.conditionRed,
    orange: colors.conditionOrange,
    yellow: colors.conditionYellow,
    green: colors.conditionGreen,
    teal: colors.conditionTeal,
  }
  return map[color] ?? colors.textTertiary
}
```

`packages/ui/src/index.ts`:
```typescript
export * from './theme'
```

**Step 3: Commit**

```bash
git add packages/ui/
git commit -m "feat: add UI package with dark theme tokens and typography"
```

---

### Task 0.5: Create Maps Package (Skeleton)

**Files:**
- Create: `packages/maps/package.json`
- Create: `packages/maps/tsconfig.json`
- Create: `packages/maps/src/index.ts`
- Create: `packages/maps/src/config.ts`
- Create: `packages/maps/src/constants.ts`

**Step 1: Create packages/maps/package.json**

```json
{
  "name": "@mysurf/maps",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mysurf/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create map config**

`packages/maps/src/config.ts`:
```typescript
export const MAP_CONFIG = {
  // California bounds
  initialRegion: {
    latitude: 36.7783,
    longitude: -121.4179,
    latitudeDelta: 8,
    longitudeDelta: 8,
  },
  // Zoom constraints
  minZoom: 5,
  maxZoom: 15,
  // Mapbox style (dark theme to match app)
  styleUrl: 'mapbox://styles/mapbox/dark-v11',
} as const

export const SWELL_COLOR_SCALE = [
  { value: 0, color: '#1a1a2e' },    // 0 ft - near black
  { value: 1.6, color: '#16213e' },  // 1.6 ft - dark blue
  { value: 3.3, color: '#0f3460' },  // 3.3 ft - blue
  { value: 5, color: '#533483' },    // 5 ft - purple
  { value: 6.6, color: '#e94560' },  // 6.6 ft - red
  { value: 10, color: '#ff6b6b' },   // 10 ft - bright red
  { value: 20, color: '#ffd93d' },   // 20 ft - yellow
  { value: 30, color: '#ffffff' },   // 30 ft - white
] as const

export const WIND_ARROW_CONFIG = {
  minSpeedKts: 3,    // Don't show arrows below this
  maxArrowSize: 24,  // Pixels
  minArrowSize: 8,
} as const
```

`packages/maps/src/constants.ts`:
```typescript
// NDBC buoy stations along California coast
export const CA_BUOYS = [
  { id: '46014', name: 'Point Arena', lat: 39.196, lng: -123.969 },
  { id: '46013', name: 'Bodega Bay', lat: 38.242, lng: -123.301 },
  { id: '46026', name: 'San Francisco', lat: 37.759, lng: -122.833 },
  { id: '46012', name: 'Half Moon Bay', lat: 37.363, lng: -122.881 },
  { id: '46042', name: 'Monterey', lat: 36.785, lng: -122.398 },
  { id: '46011', name: 'Santa Maria', lat: 34.868, lng: -120.857 },
  { id: '46054', name: 'West Santa Barbara', lat: 34.274, lng: -120.453 },
  { id: '46053', name: 'East Santa Barbara', lat: 34.248, lng: -119.841 },
  { id: '46025', name: 'Catalina Ridge', lat: 33.749, lng: -119.053 },
  { id: '46047', name: 'Tanner Banks', lat: 32.433, lng: -119.533 },
  { id: '46086', name: 'San Clemente Basin', lat: 32.491, lng: -118.034 },
  { id: '46225', name: 'Torrey Pines', lat: 32.933, lng: -117.391 },
  { id: '46232', name: 'Point Loma South', lat: 32.530, lng: -117.431 },
] as const

// NOAA CO-OPS tide stations along California
export const CA_TIDE_STATIONS = [
  { id: '9419750', name: 'Crescent City', lat: 41.745, lng: -124.184 },
  { id: '9414290', name: 'San Francisco', lat: 37.806, lng: -122.465 },
  { id: '9413450', name: 'Monterey', lat: 36.605, lng: -121.888 },
  { id: '9411340', name: 'Santa Barbara', lat: 34.408, lng: -119.685 },
  { id: '9410660', name: 'Los Angeles', lat: 33.720, lng: -118.272 },
  { id: '9410170', name: 'San Diego', lat: 32.714, lng: -117.174 },
] as const

// California regions with bounding boxes for data queries
export const CA_REGIONS = {
  humboldt: { name: 'Humboldt', bounds: { north: 41.5, south: 40.5, west: -124.5, east: -123.5 } },
  mendocino: { name: 'Mendocino', bounds: { north: 40.5, south: 38.5, west: -124.0, east: -123.0 } },
  san_francisco: { name: 'San Francisco', bounds: { north: 38.0, south: 37.4, west: -123.0, east: -122.0 } },
  santa_cruz: { name: 'Santa Cruz', bounds: { north: 37.4, south: 36.8, west: -122.5, east: -121.5 } },
  monterey: { name: 'Monterey', bounds: { north: 36.8, south: 35.5, west: -122.0, east: -121.0 } },
  san_luis_obispo: { name: 'San Luis Obispo', bounds: { north: 35.5, south: 34.8, west: -121.5, east: -120.0 } },
  santa_barbara: { name: 'Santa Barbara', bounds: { north: 34.8, south: 34.3, west: -120.5, east: -119.5 } },
  ventura: { name: 'Ventura', bounds: { north: 34.4, south: 34.0, west: -119.5, east: -118.8 } },
  la_north: { name: 'LA North', bounds: { north: 34.1, south: 33.8, west: -119.0, east: -118.2 } },
  la_south_bay: { name: 'LA South Bay', bounds: { north: 33.9, south: 33.6, west: -118.6, east: -118.2 } },
  orange_county: { name: 'Orange County', bounds: { north: 33.7, south: 33.3, west: -118.2, east: -117.5 } },
  san_diego_north: { name: 'San Diego North', bounds: { north: 33.3, south: 32.9, west: -117.6, east: -117.1 } },
  san_diego_south: { name: 'San Diego South', bounds: { north: 32.9, south: 32.5, west: -117.4, east: -117.0 } },
} as const
```

`packages/maps/src/index.ts`:
```typescript
export * from './config'
export * from './constants'
```

**Step 3: Commit**

```bash
git add packages/maps/
git commit -m "feat: add maps package with config, buoy stations, tide stations, and CA regions"
```

---

## Phase 1: Supabase Backend Setup

> Sets up the database schema, PostGIS functions, Row Level Security policies, seed data, and Edge Functions.

### Task 1.1: Initialize Supabase Project

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/.gitignore`

**Step 1: Install Supabase CLI if not present**

Run: `which supabase || brew install supabase/tap/supabase`

**Step 2: Initialize Supabase in the project**

Run: `cd /Users/trey/Desktop/Apps/MySurf && supabase init`
Expected: Creates `supabase/` directory with `config.toml`

**Step 3: Link to a Supabase project (or create one)**

Run: `supabase login` (if not already authenticated)
Then: `supabase link --project-ref <YOUR_PROJECT_REF>` (after creating project at supabase.com)

Note: For local development, use `supabase start` to spin up a local Supabase instance.

**Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: initialize supabase project"
```

---

### Task 1.2: Create Database Migrations

**Files:**
- Create: `supabase/migrations/00001_enable_extensions.sql`
- Create: `supabase/migrations/00002_create_spots.sql`
- Create: `supabase/migrations/00003_create_forecasts.sql`
- Create: `supabase/migrations/00004_create_tides_and_buoys.sql`
- Create: `supabase/migrations/00005_create_narratives.sql`
- Create: `supabase/migrations/00006_create_user_tables.sql`
- Create: `supabase/migrations/00007_create_rpc_functions.sql`

**Step 1: Create each migration file**

See the full SQL schema in the design document (`docs/plans/2026-02-21-mysurf-design.md`, Section 2).

Split into individual migration files for clean rollback. Each migration creates one logical group of tables.

Key migration: `00007_create_rpc_functions.sql` creates the PostGIS `nearby_spots` function:

```sql
-- Function to find spots within a radius of a given point
CREATE OR REPLACE FUNCTION nearby_spots(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_km DOUBLE PRECISION DEFAULT 50)
RETURNS SETOF spots
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM spots
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000  -- Convert km to meters
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$;

-- Function to find the nearest tide station to a spot
CREATE OR REPLACE FUNCTION nearest_tide_station(spot_lat DOUBLE PRECISION, spot_lng DOUBLE PRECISION)
RETURNS TABLE(station_id TEXT, station_name TEXT, distance_km DOUBLE PRECISION)
LANGUAGE sql
STABLE
AS $$
  SELECT
    station_id,
    station_name,
    ST_Distance(location, ST_SetSRID(ST_MakePoint(spot_lng, spot_lat), 4326)::geography) / 1000 AS distance_km
  FROM tides
  GROUP BY station_id, station_name, location
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(spot_lng, spot_lat), 4326)::geography
  LIMIT 1;
$$;
```

**Step 2: Apply migrations locally**

Run: `cd /Users/trey/Desktop/Apps/MySurf && supabase db reset`
Expected: All migrations applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add database schema migrations (spots, forecasts, tides, buoys, narratives, users)"
```

---

### Task 1.3: Seed California Surf Spots

**Files:**
- Create: `supabase/seed/california-spots.sql`

**Step 1: Create seed file with ~200 California surf spots**

This file inserts curated spot data including: name, slug, coordinates, orientation, spot type, ideal swell/tide parameters, region, skill level, crowd factor, and hazards.

Example entries:
```sql
INSERT INTO spots (name, slug, location, orientation_degrees, spot_type, ideal_swell_dir_min, ideal_swell_dir_max, ideal_tide_low, ideal_tide_high, skill_level, is_curated, region, description, crowd_factor, hazards) VALUES
('Rincon (The Cove)', 'rincon-the-cove', ST_SetSRID(ST_MakePoint(-119.4762, 34.3735), 4326)::geography, 195, 'point_break', 250, 320, 0.5, 4.0, 'all', true, 'santa_barbara', 'World-class right point break. Best on medium to large WNW-NW swell with light winds.', 5, ARRAY['localism', 'rocks']),
('C Street', 'c-street', ST_SetSRID(ST_MakePoint(-119.2648, 34.2738), 4326)::geography, 190, 'point_break', 230, 300, 1.0, 4.0, 'all', true, 'ventura', 'Long right point break along the Ventura promenade. Multiple peaks and sections.', 4, ARRAY['rocks']),
('Ventura Harbor', 'ventura-harbor', ST_SetSRID(ST_MakePoint(-119.2793, 34.2497), 4326)::geography, 210, 'beach_break', 200, 310, 0.5, 3.5, 'beginner', true, 'ventura', 'Soft beach break near the harbor jetty. Good for beginners.', 3, ARRAY['rip_currents']),
('Mussel Shoals', 'mussel-shoals', ST_SetSRID(ST_MakePoint(-119.3987, 34.3502), 4326)::geography, 195, 'point_break', 260, 330, 1.0, 4.0, 'intermediate', true, 'ventura', 'Also known as Little Rincon. Smaller, less crowded version of Rincon.', 2, ARRAY['rocks']),
-- ... 196 more spots covering all 13 CA regions
```

**Step 2: Apply seed data**

Run: `cd /Users/trey/Desktop/Apps/MySurf && supabase db reset` (re-applies migrations + seed)
Expected: 200 spots inserted

**Step 3: Commit**

```bash
git add supabase/seed/
git commit -m "feat: seed 200 California surf spots with coordinates and parameters"
```

---

### Task 1.4: Set Up Row Level Security (RLS)

**Files:**
- Create: `supabase/migrations/00008_rls_policies.sql`

**Step 1: Create RLS policies**

```sql
-- Spots: public read, authenticated create (community spots)
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spots are publicly readable" ON spots FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create spots" ON spots FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Forecasts: public read
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forecasts are publicly readable" ON forecasts FOR SELECT USING (true);

-- Narratives: public read
ALTER TABLE narratives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Narratives are publicly readable" ON narratives FOR SELECT USING (true);

-- Tides: public read
ALTER TABLE tides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tides are publicly readable" ON tides FOR SELECT USING (true);

-- Buoy readings: public read
ALTER TABLE buoy_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buoy readings are publicly readable" ON buoy_readings FOR SELECT USING (true);

-- User favorites: own data only
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own favorites" ON user_favorites
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User pins: own data + public pins readable
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read public pins and their own" ON user_pins
  FOR SELECT USING (is_public OR auth.uid() = user_id);
CREATE POLICY "Users can manage their own pins" ON user_pins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pins" ON user_pins
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pins" ON user_pins
  FOR DELETE USING (auth.uid() = user_id);

-- Surf sessions: own data only
ALTER TABLE surf_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sessions" ON surf_sessions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Subscriptions: own data only
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
```

**Step 2: Apply migration**

Run: `supabase db reset`
Expected: All migrations + RLS applied

**Step 3: Commit**

```bash
git add supabase/migrations/00008_rls_policies.sql
git commit -m "feat: add Row Level Security policies for all tables"
```

---

## Phase 2: Expo Mobile App Shell

> Creates the Expo project with tab navigation, dark theme, and placeholder screens matching the Surfline-inspired UI.

### Task 2.1: Initialize Expo App

**Files:**
- Create: `apps/mobile/` (Expo project)

**Step 1: Create Expo app with Expo Router**

Run: `cd /Users/trey/Desktop/Apps/MySurf/apps && bunx create-expo-app@latest mobile --template tabs`
Expected: Creates Expo project with tab navigation

**Step 2: Update apps/mobile/package.json** to use workspace dependencies:

Add to dependencies:
```json
"@mysurf/shared": "workspace:*",
"@mysurf/api": "workspace:*",
"@mysurf/ui": "workspace:*",
"@mysurf/maps": "workspace:*"
```

**Step 3: Install dependencies**

Run: `cd /Users/trey/Desktop/Apps/MySurf && bun install`

**Step 4: Verify app runs**

Run: `cd apps/mobile && bun run start`
Expected: Expo dev server starts, QR code displayed

**Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat: initialize Expo mobile app with tab navigation"
```

---

### Task 2.2: Set Up Tab Navigation (5 tabs)

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx` (Home)
- Create: `apps/mobile/app/(tabs)/map.tsx` (Map)
- Create: `apps/mobile/app/(tabs)/sessions.tsx` (Sessions)
- Create: `apps/mobile/app/(tabs)/favorites.tsx` (Favorites)
- Create: `apps/mobile/app/(tabs)/account.tsx` (Account)

**Step 1: Update tab layout** with 5 tabs matching the Surfline bottom nav, using dark theme colors from `@mysurf/ui`.

Tab icons: Home (circle), Map (pin), Sessions (refresh), Favorites (list), Account (person)

**Step 2: Create placeholder screens** for each tab with the dark background (`#0D0D0D`) and white text.

**Step 3: Verify all 5 tabs render**

Run: `cd apps/mobile && bun run start`
Expected: All 5 tabs visible and navigable

**Step 4: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat: add 5-tab navigation (Home, Map, Sessions, Favorites, Account)"
```

---

### Task 2.3: Build Home Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/components/home/greeting-header.tsx`
- Create: `apps/mobile/components/home/regional-narrative.tsx`
- Create: `apps/mobile/components/home/day-selector.tsx`
- Create: `apps/mobile/components/home/spot-forecast-card.tsx`

**Step 1: Create GreetingHeader** — "Good afternoon, {name}" with + and search icons

**Step 2: Create RegionalNarrative** — Multi-day forecast text card (Sat/Mon/Tue format, matching Screenshot 2)

**Step 3: Create DaySelector** — Horizontal scroll of day chips with star favorites

**Step 4: Create SpotForecastCard** — Spot name, wave height range, condition color dots (5 circles: red/orange/yellow/green/teal pattern)

**Step 5: Compose Home screen** — GreetingHeader + RegionalNarrative + DaySelector + FlatList of SpotForecastCards

**Step 6: Wire up with mock data** (hardcoded, matching screenshot values)

**Step 7: Commit**

```bash
git add apps/mobile/components/home/ apps/mobile/app/
git commit -m "feat: build Home screen with greeting, narrative, day selector, and spot cards"
```

---

### Task 2.4: Build Spot Detail Screen

**Files:**
- Create: `apps/mobile/app/spot/[slug].tsx`
- Create: `apps/mobile/components/spot/spot-header.tsx`
- Create: `apps/mobile/components/spot/tab-bar.tsx` (Live/Forecast/Analysis/Charts/Guide)
- Create: `apps/mobile/components/spot/forecast-tab/sixteen-day-forecast.tsx`
- Create: `apps/mobile/components/spot/forecast-tab/surf-section.tsx`
- Create: `apps/mobile/components/spot/forecast-tab/wind-section.tsx`
- Create: `apps/mobile/components/spot/forecast-tab/tide-section.tsx`
- Create: `apps/mobile/components/spot/forecast-tab/energy-card.tsx`
- Create: `apps/mobile/components/spot/forecast-tab/consistency-card.tsx`
- Create: `apps/mobile/components/spot/analysis-tab/narrative-card.tsx`

**Step 1: Create SpotHeader** — Back arrow, spot name, + button

**Step 2: Create custom TabBar** — 5 tabs (Live/Forecast/Analysis/Charts/Guide) with underline indicator

**Step 3: Build Forecast Tab components:**
- SixteenDayForecast: horizontal scroll cards with day/date, wave height, swell arrows, condition bar
- SurfSection: height range + label, swell component table, hourly bar chart
- WindSection: speed/gust, direction label, hourly bar chart with arrows
- TideSection: tide curve chart with labeled peaks/troughs, sunrise/sunset times
- EnergyCard: metric value (kJ) + hourly bar chart
- ConsistencyCard: score out of 100 + hourly area chart

**Step 4: Build Analysis Tab:**
- NarrativeCard: AI forecaster avatar/name, date, bold summary, body text, helpful vote buttons

**Step 5: Wire up with mock data** matching screenshot values

**Step 6: Commit**

```bash
git add apps/mobile/app/spot/ apps/mobile/components/spot/
git commit -m "feat: build Spot Detail screen with Forecast and Analysis tabs"
```

---

### Task 2.5: Build Swell Map Screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`
- Create: `apps/mobile/components/map/swell-map.tsx`
- Create: `apps/mobile/components/map/time-scrubber.tsx`
- Create: `apps/mobile/components/map/spot-marker.tsx`
- Create: `apps/mobile/components/map/tap-popup.tsx`
- Create: `apps/mobile/components/map/map-controls.tsx`
- Create: `apps/mobile/components/map/legend.tsx`

**Step 1: Install @rnmapbox/maps**

Run: `cd apps/mobile && bun add @rnmapbox/maps`

**Step 2: Create SwellMap** — Full-screen Mapbox map with dark style, California bounds

**Step 3: Create TimeScrubber** — Bottom bar with time indicator, day labels, play button (matching Screenshot 1)

**Step 4: Create SpotMarker** — Colored circle markers for each spot on the map

**Step 5: Create TapPopup** — When user taps coastline, show model data + "Pin this spot" button

**Step 6: Create MapControls** — Floating right-side buttons (Home, Search, Pin, Favorites, Menu)

**Step 7: Create Legend** — Wave height color scale (ft: 1.6, 3.3, 5, 6.6, 20, 30)

**Step 8: Commit**

```bash
git add apps/mobile/components/map/ apps/mobile/app/
git commit -m "feat: build Swell Map screen with Mapbox, time scrubber, and spot markers"
```

---

## Phase 3: Data Pipeline

> Builds the service that ingests NOAA WaveWatch III, NDBC buoy data, and NOAA tide predictions, processes them into spot-level forecasts, and generates AI narratives.

### Task 3.1: Create Data Pipeline App

**Files:**
- Create: `apps/data-pipeline/package.json`
- Create: `apps/data-pipeline/tsconfig.json`
- Create: `apps/data-pipeline/src/index.ts`
- Create: `apps/data-pipeline/src/ingestors/ndbc-buoys.ts`
- Create: `apps/data-pipeline/src/ingestors/noaa-tides.ts`
- Create: `apps/data-pipeline/src/ingestors/wavewatch.ts`

**Step 1: Set up data-pipeline app** with TypeScript, node-cron, and fetch-based HTTP clients

**Step 2: Create NDBC buoy ingestor** — Fetches real-time data from `ndbc.noaa.gov/data/realtime2/{station}.txt`

**Step 3: Create NOAA tides ingestor** — Fetches predictions from `api.tidesandcurrents.noaa.gov`

**Step 4: Create WaveWatch III ingestor** — Downloads GRIB2 files from NOAA's NOMADS server, parses grid data

**Step 5: Add tests for each ingestor** (mock HTTP responses)

**Step 6: Commit**

```bash
git add apps/data-pipeline/
git commit -m "feat: add data pipeline with NDBC, NOAA tides, and WaveWatch III ingestors"
```

---

### Task 3.2: Forecast Computation Engine

**Files:**
- Create: `packages/shared/src/models/rating.ts`
- Create: `packages/shared/src/models/energy.ts`
- Create: `packages/shared/src/models/wind.ts`
- Create: `packages/shared/src/models/index.ts`
- Create: `packages/shared/src/utils/geo.ts`
- Create: `packages/shared/src/utils/directions.ts`
- Create: `packages/shared/tests/models/rating.test.ts`

**Step 1: Write failing test for `computeSpotRating`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeSpotRating } from '../../src/models/rating'

describe('computeSpotRating', () => {
  const rincon = {
    orientationDegrees: 195,
    idealSwellDirMin: 250,
    idealSwellDirMax: 320,
    idealTideLow: 0.5,
    idealTideHigh: 4.0,
    spotType: 'point_break' as const,
  }

  it('rates ideal NW swell with offshore wind as 4-5 stars', () => {
    const forecast = {
      swellComponents: [{ heightFt: 6, periodSeconds: 15, directionDegrees: 290 }],
      windSpeedKts: 5,
      windDirectionDegrees: 15, // NNE = offshore for SSW-facing
      tideHeightFt: 2.0,
      consistency: 0.8,
    }
    const result = computeSpotRating(rincon, forecast)
    expect(result.stars).toBeGreaterThanOrEqual(4)
    expect(result.color).toBe('green')
  })

  it('rates small onshore wind swell as 1-2 stars', () => {
    const forecast = {
      swellComponents: [{ heightFt: 1, periodSeconds: 7, directionDegrees: 190 }],
      windSpeedKts: 15,
      windDirectionDegrees: 195, // SSW = onshore for SSW-facing
      tideHeightFt: 2.0,
      consistency: 0.2,
    }
    const result = computeSpotRating(rincon, forecast)
    expect(result.stars).toBeLessThanOrEqual(2)
    expect(['red', 'orange']).toContain(result.color)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test`
Expected: FAIL — `computeSpotRating` not defined

**Step 3: Implement `computeSpotRating`** per the algorithm in the design document

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test`
Expected: PASS

**Step 5: Add more edge case tests** (no swell, extreme wind, tide out of range, multi-component swell)

**Step 6: Commit**

```bash
git add packages/shared/src/models/ packages/shared/src/utils/ packages/shared/tests/
git commit -m "feat: implement spot rating algorithm with TDD (swell, wind, tide, consistency scoring)"
```

---

### Task 3.3: AI Narrative Generator

**Files:**
- Create: `apps/data-pipeline/src/generators/narrative.ts`
- Create: `apps/data-pipeline/src/generators/prompts.ts`
- Create: `apps/data-pipeline/tests/generators/narrative.test.ts`

**Step 1: Create prompt template** matching the style from the design document

**Step 2: Create `generateNarrative` function** that:
- Accepts region forecast data
- Builds a prompt with current conditions, swell components, wind, tide
- Calls Claude API (`@anthropic-ai/sdk`)
- Parses response into `{ summary, body }` format
- Stores in `narratives` table

**Step 3: Write tests** with mocked Claude API responses

**Step 4: Commit**

```bash
git add apps/data-pipeline/src/generators/ apps/data-pipeline/tests/
git commit -m "feat: add AI narrative generator using Claude API with surfer-voice prompts"
```

---

### Task 3.4: Swell Map Tile Generator

**Files:**
- Create: `apps/data-pipeline/src/processors/tile-generator.ts`
- Create: `apps/data-pipeline/src/processors/color-mapper.ts`

**Step 1: Create color mapper** — Maps wave height values to colors using the SWELL_COLOR_SCALE from `@mysurf/maps`

**Step 2: Create tile generator** that:
- Reads WaveWatch III grid data
- Generates raster tile PNGs at standard zoom levels
- Uploads to Supabase Storage (or S3/R2)
- Supports time-series tiles (one set per forecast hour)

**Step 3: Commit**

```bash
git add apps/data-pipeline/src/processors/
git commit -m "feat: add swell map tile generator from WaveWatch III grid data"
```

---

### Task 3.5: Data Pipeline Scheduler

**Files:**
- Create: `apps/data-pipeline/src/schedulers/cron.ts`
- Modify: `apps/data-pipeline/src/index.ts`

**Step 1: Set up cron jobs:**
- Every 30 min: Fetch NDBC buoy readings
- Every 6 hours: Fetch WaveWatch III, compute forecasts, generate tiles
- Every 6 hours: Generate AI narratives for all regions
- Daily: Fetch 7-day tide predictions

**Step 2: Create main entry point** that initializes Supabase, starts cron scheduler

**Step 3: Add dry-run mode** for testing without writing to DB

**Step 4: Commit**

```bash
git add apps/data-pipeline/
git commit -m "feat: add cron scheduler for data pipeline (buoys, forecasts, tiles, narratives)"
```

---

## Phase 4: Connect Mobile App to Backend

> Wires up the Expo app to Supabase, replacing mock data with real queries.

### Task 4.1: Supabase Auth Integration

**Files:**
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/auth-context.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/signup.tsx`

**Step 1: Initialize Supabase client** with `@supabase/supabase-js` + Expo SecureStore for token persistence

**Step 2: Create AuthContext** — React context providing user, loading, login, signup, logout

**Step 3: Build Login screen** — Email + password, Apple Sign-In, Google Sign-In buttons

**Step 4: Build Signup screen** — Email, password, display name

**Step 5: Wrap app in AuthContext** and gate tabs behind auth

**Step 6: Commit**

```bash
git add apps/mobile/lib/ apps/mobile/app/
git commit -m "feat: add Supabase auth with email, Apple Sign-In, and Google Sign-In"
```

---

### Task 4.2: Wire Home Screen to Real Data

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/hooks/use-favorites.ts`
- Create: `apps/mobile/hooks/use-regional-narrative.ts`

**Step 1: Create `useFavorites` hook** — Fetches user's favorited spots with latest forecast data

**Step 2: Create `useRegionalNarrative` hook** — Fetches AI narrative for user's home region

**Step 3: Replace mock data** in Home screen with real Supabase queries

**Step 4: Commit**

```bash
git add apps/mobile/hooks/ apps/mobile/app/
git commit -m "feat: wire Home screen to Supabase (favorites, narratives, forecasts)"
```

---

### Task 4.3: Wire Spot Detail to Real Data

**Files:**
- Modify: `apps/mobile/app/spot/[slug].tsx`
- Create: `apps/mobile/hooks/use-spot-forecast.ts`
- Create: `apps/mobile/hooks/use-spot-narrative.ts`
- Create: `apps/mobile/hooks/use-tides.ts`

**Step 1: Create hooks** for spot forecast, narrative, and tide data

**Step 2: Wire all Forecast tab components** to real data

**Step 3: Wire Analysis tab** to AI narratives

**Step 4: Add loading states and error handling**

**Step 5: Commit**

```bash
git add apps/mobile/hooks/ apps/mobile/app/
git commit -m "feat: wire Spot Detail screen to Supabase (forecast, tides, narratives)"
```

---

### Task 4.4: Wire Swell Map to Real Data

**Files:**
- Modify: `apps/mobile/app/(tabs)/map.tsx`
- Create: `apps/mobile/hooks/use-map-spots.ts`
- Create: `apps/mobile/hooks/use-swell-tiles.ts`

**Step 1: Create `useMapSpots` hook** — Fetches spots within current map viewport

**Step 2: Create `useSwellTiles` hook** — Manages swell overlay tile URLs for current time

**Step 3: Wire map markers** to real spot data with condition colors

**Step 4: Wire time scrubber** to tile set switching

**Step 5: Implement tap-anywhere** — Reverse geocode tap location, show nearest grid point data

**Step 6: Commit**

```bash
git add apps/mobile/hooks/ apps/mobile/app/
git commit -m "feat: wire Swell Map to Supabase (spot markers, swell tiles, tap-anywhere)"
```

---

## Phase 5: Next.js Web App

> Builds the web version with the same screens and shared packages.

### Task 5.1: Initialize Next.js App

**Files:**
- Create: `apps/web/` (Next.js 15 project)

**Step 1: Create Next.js app**

Run: `cd /Users/trey/Desktop/Apps/MySurf/apps && bunx create-next-app@latest web --typescript --tailwind --app --no-src-dir`

**Step 2: Add workspace dependencies** (`@mysurf/shared`, `@mysurf/api`, `@mysurf/ui`, `@mysurf/maps`)

**Step 3: Configure dark theme** in Tailwind using the same color tokens from `@mysurf/ui`

**Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat: initialize Next.js 15 web app with Tailwind and workspace packages"
```

---

### Task 5.2: Build Web Home Page

**Files:**
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/components/home/greeting-header.tsx`
- Create: `apps/web/components/home/regional-narrative.tsx`
- Create: `apps/web/components/home/spot-card.tsx`

**Step 1: Build responsive Home page** matching the mobile design (dark theme, spot cards, day selector)

**Step 2: Commit**

---

### Task 5.3: Build Web Map Page

**Files:**
- Create: `apps/web/app/map/page.tsx`
- Create: `apps/web/components/map/swell-map.tsx` (MapLibre GL JS)

**Step 1: Build full-screen swell map** using MapLibre GL JS with the same overlay and interaction patterns

**Step 2: Commit**

---

### Task 5.4: Build Web Spot Detail Page

**Files:**
- Create: `apps/web/app/spot/[slug]/page.tsx`
- Create: `apps/web/components/spot/` (web versions of forecast/analysis components)

**Step 1: Build responsive Spot Detail** with the same tab structure (Live/Forecast/Analysis/Charts/Guide)

**Step 2: Commit**

---

## Phase 6: Polish & Ship

### Task 6.1: Push Notifications

- Daily forecast summary for home region
- Swell alerts ("Big swell arriving in 3 days")
- Expo Notifications + Supabase Edge Function for triggers

### Task 6.2: Offline Caching

- Cache last-fetched forecasts in AsyncStorage (mobile) / localStorage (web)
- Show stale data with "Last updated X hours ago" indicator

### Task 6.3: Premium Subscription

- 16-day forecast gate (free users see 7 days)
- RevenueCat integration for iOS/Android IAP ($5/year)
- Supabase webhook to update subscription status

### Task 6.4: Community Spot Creation

- "Pin a spot" flow from map screen
- Name, notes, public/private toggle
- Community validation over time (upvotes on accuracy)

### Task 6.5: Session Logging

- Log session form (spot, date, time, rating, notes, photo upload)
- Session history list with filters
- Conditions snapshot at session time

### Task 6.6: App Store Preparation

- App icons and splash screens
- App Store / Play Store metadata
- Privacy policy and terms of service
- EAS Build configuration for Expo

### Task 6.7: CLAUDE.md and Timeline

- Create `/Users/trey/Desktop/Apps/MySurf/CLAUDE.md` with full project documentation
- Create `/Users/trey/Desktop/Apps/MySurf/timeline.md` for change tracking
- Update `/Users/trey/Desktop/Apps/CLAUDE.md` to include MySurf in the Projects section

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 0 | 5 tasks | Monorepo scaffold, shared types, API client, UI theme, maps config |
| 1 | 4 tasks | Supabase schema, migrations, seed data, RLS policies |
| 2 | 5 tasks | Expo app shell, 5-tab nav, Home/Spot/Map screens with mock data |
| 3 | 5 tasks | Data pipeline (buoy/tide/wave ingestors, forecast engine, AI narratives, tile gen) |
| 4 | 4 tasks | Wire mobile app to Supabase (auth, home, spot detail, map) |
| 5 | 4 tasks | Next.js web app (home, map, spot detail) |
| 6 | 7 tasks | Polish (notifications, offline, premium, community, sessions, app store) |

**Total: 34 tasks across 7 phases**

The first 3 phases can be developed in parallel by a team:
- **Phase 0** must complete first (foundation)
- **Phase 1** (backend) and **Phase 2** (mobile shell with mock data) can run in parallel
- **Phase 3** (data pipeline) depends on Phase 1 (needs DB schema)
- **Phase 4** depends on Phases 1, 2, 3 (wiring frontend to backend)
- **Phase 5** depends on Phase 0 and can partially parallelize with Phase 4
- **Phase 6** depends on Phase 4
