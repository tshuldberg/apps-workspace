Perfect! Now I have enough information to create a comprehensive report. Let me compile all the findings:

---

# EasyStreet Monorepo - Feature Requirements Document

## Executive Summary

**EasyStreet** is a cross-platform street sweeping parking assistant for San Francisco residents. The monorepo contains a **TypeScript-based Turborepo** with a serverless backend (Convex), a React Native mobile app (Expo), a Next.js web app, and shared business logic packages. The application helps users avoid parking tickets by providing real-time street sweeping schedules, location tracking, and customizable notifications.

---

## 1. App Overview

### Purpose
EasyStreet helps San Francisco residents avoid parking tickets by:
- Displaying street sweeping schedules on an interactive map
- Allowing users to mark where they parked ("I Parked Here" feature)
- Sending advance notifications before sweeping occurs at the parked location
- Supporting multiple notification lead times (2 hours to 48 hours)
- Providing street-level detail views with sweeping rule information

### Target Platforms
- **Mobile**: Expo (React Native) for iOS/Android
- **Web**: Next.js 15 for desktop/browser access
- **Backend**: Convex (serverless database + real-time API)

### Geographic Scope
Currently **San Francisco only**, but architecture supports multi-city expansion (see constants: `CITY_CONFIGS`)

---

## 2. Technology Stack

### Core
- **Monorepo**: Turborepo v2.4.0 with Bun 1.2.4 package manager
- **TypeScript**: v5.7.0 across all packages
- **Runtime**: Node.js/Bun for backend, React 19 for web/mobile

### Frontend (Web & Mobile)
- **Web**: Next.js 15.1.0 with Turbopack, React 19
- **Mobile**: Expo 54.0.0, React Native 0.76.9, Expo Router 4.0.0
- **Styling**: Tailwind CSS 4.0.0 (web), Uniwind + Tailwind (mobile)
- **Maps**: 
  - Web: MapLibre GL 4.0.0 + react-map-gl 7.1.0
  - Mobile: react-native-maps 1.20.1 (native Google Maps)

### Backend & Data
- **Backend Framework**: Convex 1.18.0 (serverless database with real-time subscriptions)
- **Database**: Convex (replaces traditional PostgreSQL/MongoDB)
- **Schema**: TypeScript-defined with full-text search and spatial indexing

### Notifications & Location
- **Mobile Notifications**: expo-notifications 0.30.0
- **Mobile Location**: expo-location 18.0.0
- **Secure Storage**: expo-secure-store 14.0.0
- **Navigation**: Expo Router (file-based routing)

### Development Tools
- **Testing**: Vitest 3.0.0 (shared package only)
- **Linting**: ESLint (eslint-config workspace)
- **Configuration**: TypeScript configs workspace

### Build & Deployment
- **Package Manager**: Bun 1.2.4
- **Task Runner**: Turbo (caching, task graph)
- **Build Outputs**: .next (web), dist (backend), compiled TS (shared)

---

## 3. Monorepo Architecture

### Directory Structure
```
easystreet-monorepo/
├── apps/
│   ├── web/                    # Next.js 15 web app
│   │   ├── src/app/            # App Router pages & layout
│   │   ├── src/components/     # Shared UI components
│   │   ├── src/hooks/          # Custom React hooks
│   │   └── package.json        # Dependencies: convex, maplibre-gl, react-map-gl
│   │
│   └── mobile/                 # Expo/React Native app
│       ├── app/                # Expo Router file-based routes
│       ├── src/components/     # React Native components
│       ├── src/data/           # Local storage & caching
│       ├── src/hooks/          # Location, device ID hooks
│       ├── src/services/       # Notifications, offline support
│       └── package.json        # Dependencies: expo, react-native-maps, convex
│
├── packages/
│   ├── shared/                 # Shared TypeScript logic
│   │   ├── src/
│   │   │   ├── types.ts        # Core data models (SweepingRule, StreetSegment, ParkedCar)
│   │   │   ├── sweepingRuleEngine.ts    # Status evaluation logic
│   │   │   ├── holidayCalculator.ts    # Dynamic SF holiday calculation
│   │   │   ├── countdownFormatter.ts   # Time formatting
│   │   │   ├── constants.ts    # City configs, notification defaults
│   │   │   └── index.ts        # Public exports
│   │   └── package.json
│   │
│   ├── backend/                # Convex serverless backend
│   │   ├── convex/
│   │   │   ├── schema.ts       # Database schema definition
│   │   │   ├── streets.ts      # Street segment queries (spatial filtering)
│   │   │   ├── parking.ts      # Parked car mutations
│   │   │   ├── preferences.ts  # User preferences queries/mutations
│   │   │   ├── seed.ts         # Database seeding from CSV
│   │   │   └── _generated/     # Auto-generated Convex API types
│   │   └── package.json
│   │
│   ├── typescript-config/      # Shared TypeScript configuration
│   ├── eslint-config/          # Shared ESLint rules
│   └── ...
│
├── turbo.json                  # Turborepo task graph & caching
├── package.json               # Root scripts (dev, build, test, lint, typecheck)
└── README.md
```

### Workspace Organization
```json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",                    // Start all dev servers
    "dev:web": "turbo run dev --filter=web",   // Web only
    "dev:mobile": "turbo run dev --filter=mobile",  // Mobile only
    "dev:backend": "turbo run dev --filter=@repo/backend",  // Convex only
    "build": "turbo run build",                // Build all
    "test": "turbo run test",                  // Run all tests
    "lint": "turbo run lint",                  // Lint all
    "typecheck": "turbo run typecheck"         // Type check all
  }
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                   Convex Backend                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Database Tables:                                │   │
│  │  • streetSegments (37K records, spatial indexes) │   │
│  │  • parkedCars (user parking state)              │   │
│  │  • userPreferences (notification settings)      │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │ Queries:                                │    │   │
│  │  │ • getSegmentsInBounds()                 │    │   │
│  │  │ • getSegmentById()                      │    │   │
│  │  │ • searchStreets()                       │    │   │
│  │  │ • findNearestSegment()                  │    │   │
│  │  │ • getParkedCar()                        │    │   │
│  │  │ • getPreferences()                      │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │ Mutations:                              │    │   │
│  │  │ • parkCar()                             │    │   │
│  │  │ • updateParkedLocation()                │    │   │
│  │  │ • clearParkedCar()                      │    │   │
│  │  │ • setPreferences()                      │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
       ↑                                       ↓
       │ HTTP/WebSocket (ConvexReactClient)   │
       └───────────────────────────────────────┘
              ↗                           ↖
    ┌─────────────────┐          ┌──────────────────┐
    │   Mobile App    │          │    Web App       │
    │  (React Native) │          │   (Next.js)      │
    │  + Shared Logic │          │  + Shared Logic  │
    └─────────────────┘          └──────────────────┘
         ↓                              ↓
    @repo/shared                   @repo/shared
    (Business Logic)               (Business Logic)
    ├─ sweepingRuleEngine          ├─ sweepingRuleEngine
    ├─ holidayCalculator           ├─ holidayCalculator
    ├─ types                        ├─ types
    └─ constants                    └─ constants
```

---

## 4. Shared Logic (`@repo/shared`)

### 4.1 Core Data Models (types.ts)

#### SweepingRule
```typescript
interface SweepingRule {
    dayOfWeek: number;              // 1=Sunday, 2=Monday, ..., 7=Saturday
    startTime: string;              // "HH:MM" (24-hour format)
    endTime: string;                // "HH:MM" (24-hour format)
    weeksOfMonth: number[];         // [1,3] = 1st & 3rd weeks, [] = every week
    applyOnHolidays: boolean;       // true if sweeping occurs even on holidays
}
```

#### StreetSegment
```typescript
interface StreetSegment {
    id: string;                     // Unique segment ID
    cnn?: string;                   // CNN (Centerline Network) from SF data
    streetName: string;             // "Market Street", "Mission Street"
    blockSide?: string;             // "North", "SouthEast"
    limits?: string;                // "Larkin St - Polk St"
    coordinates: Coordinate[];      // Array of lat/lng points for street polyline
    rules: SweepingRule[];          // Sweeping rules for this segment
    bounds?: Bounds;                // Bounding box for spatial queries
}
```

#### ParkedCar
```typescript
interface ParkedCar {
    deviceId: string;               // Unique device identifier
    latitude: number;
    longitude: number;
    streetName?: string;            // Auto-resolved from nearest segment
    parkedAt: number;               // Unix timestamp (ms)
    notificationLeadMinutes: number;// Default lead time (e.g., 120 = 2h)
    segmentId?: string;             // Associated street segment ID
}
```

#### UserPreferences
```typescript
interface UserPreferences {
    deviceId: string;
    hasSeenDisclaimer: boolean;
    notificationLeadMinutes: number;        // Single value (legacy support)
    notificationLeadMinutesSet?: number[];  // Multiple lead times [120,240,480]
    activeCityCode?: string;                // "sf", future: "la", "nyc"
}
```

#### SweepingStatus (Discriminated Union)
```typescript
type SweepingStatus =
    | { type: "safe" }                                    // No sweeping soon
    | { type: "today"; time: Date; streetName: string }  // Sweeping later today
    | { type: "activeNow"; streetName: string; endTime: Date } // Currently sweeping
    | { type: "imminent"; time: Date; streetName: string }     // Within 1 hour
    | { type: "upcoming"; time: Date; streetName: string }     // 1+ days away
    | { type: "noData" }                                  // No rules for street
    | { type: "unknown" };                                // Data parsing error
```

#### MapColorStatus
```typescript
type MapColorStatus = "red" | "orange" | "yellow" | "green" | "gray";
// red = sweeping today
// orange = sweeping tomorrow
// yellow = sweeping within 3 days
// green = safe (3+ days or no data)
// gray = no data
```

### 4.2 Sweeping Rule Engine (sweepingRuleEngine.ts)

**Core Functions:**

#### `ruleAppliesTo(rule: SweepingRule, date: Date): boolean`
**Purpose**: Determine if a sweeping rule applies on a given date
**Inputs**:
- `rule`: The sweeping rule to check
- `date`: The date to evaluate

**Logic**:
1. Extract day of week from date (JS getDay(): 0=Sun, convert to 1=Sun for rule matching)
2. If rule specifies specific weeks (weeksOfMonth), check if date falls in those weeks
3. If rule doesn't apply on holidays AND the date is a holiday, return false
4. Return true if all checks pass

**Output**: Boolean

**Edge Cases**:
- Week-of-month calculation: `Math.ceil(dayOfMonth / 7)` means days 1-7 are week 1, 8-14 are week 2, etc.
- Holiday checking delegates to `isHoliday()` from holidayCalculator

#### `getStatus(rules: SweepingRule[], streetName: string, at: Date): SweepingStatus`
**Purpose**: Determine the current sweeping status at a given time
**Inputs**:
- `rules`: Array of sweeping rules for a street
- `streetName`: Street name (for display in status)
- `at`: Reference time (default: now)

**Algorithm**:
1. If no rules, return `{ type: "noData" }`
2. For each rule:
   - Check if rule applies today via `ruleAppliesTo()`
   - Parse start/end times (HH:MM format)
   - Set times on the given date
   - If currently sweeping (at >= start && at < end): return `{ type: "activeNow", ... }`
   - If sweep hasn't started: calculate hours remaining
     - If < 1 hour: return `{ type: "imminent", ... }`
     - Else: return `{ type: "today", ... }`
   - If sweep already passed: continue to next rule
3. If no sweep today: call `getNextSweepingTime(rules, at)`
   - If found: return `{ type: "upcoming", ... }`
   - Else: return `{ type: "safe" }`

**Output**: SweepingStatus discriminated union

**Example Timeline**:
```
08:00 AM — Rule applies: 9am-12pm sweeping
08:00-08:59 AM: { type: "imminent", time: 9:00am, streetName: "Market St" }
09:00-11:59 AM: { type: "activeNow", streetName: "Market St", endTime: 12:00pm }
12:00+ PM:  { type: "safe" }
```

#### `getNextSweepingTime(rules: SweepingRule[], after: Date): Date | null`
**Purpose**: Find the next sweeping date/time after a given date
**Inputs**:
- `rules`: Street sweeping rules
- `after`: Start searching after this date (default: now)

**Algorithm**:
1. Initialize `earliest = null`
2. For each rule:
   - For day offset 1 to 180 (6 months):
     - Create checkDate = after + dayOffset
     - Normalize to start of day
     - If rule applies on checkDate:
       - Parse start time
       - Create sweepDate with start time on checkDate
       - If sweepDate is earliest so far: update earliest
       - Break (found soonest for this rule)
3. Return earliest or null

**Output**: Date of next sweeping, or null if no sweeping in next 180 days

#### `getMapColorStatus(rules: SweepingRule[], referenceDate: Date): MapColorStatus`
**Purpose**: Get the map color for a street segment
**Inputs**:
- `rules`: Street sweeping rules
- `referenceDate`: Reference date (default: today)

**Algorithm**:
1. If no rules: return "gray"
2. Check if any rule applies TODAY: return "red"
3. Check days +1, +2, +3:
   - Day +1: return "orange"
   - Day +2-3: return "yellow"
4. Default: return "green"

**Output**: One of: "red", "orange", "yellow", "green", "gray"

### 4.3 Holiday Calculator (holidayCalculator.ts)

**Purpose**: Dynamically calculate San Francisco public holidays for any year (no hardcoded dates)

#### `getHolidays(year: number): Date[]`
**Returns** 11 SF public holidays for a given year:

**Fixed Holidays** (with observed-date shifting):
1. New Year's Day (Jan 1)
2. Independence Day (Jul 4)
3. Veterans Day (Nov 11)
4. Christmas (Dec 25)

**Floating Holidays**:
5. MLK Day (3rd Monday of January)
6. Presidents' Day (3rd Monday of February)
7. Memorial Day (last Monday of May)
8. Labor Day (1st Monday of September)
9. Indigenous Peoples' Day (2nd Monday of October)
10. Thanksgiving (4th Thursday of November)
11. Day After Thanksgiving (day after #10)

**Observed-Date Logic**:
- Saturday holidays → observed Friday
- Sunday holidays → observed Monday
- (Matches SF Parking & Traffic (SFMTA) rules)

**Caching**: Results cached in a Map to avoid recalculation for same year

#### `isHoliday(date: Date): boolean`
**Purpose**: Check if a date falls on any SF public holiday
**Logic**:
1. Get all holidays for the date's year
2. Check if date matches any holiday (same year, month, day)
3. Also check next year's New Year's if in December (observed date can shift into Dec)
4. Return boolean

**Edge Case**: January 1, 2025 that falls on Monday is observed as Monday (no shift needed)

#### Helper Functions
- `observedDate(date: Date)`: Apply Saturday→Friday, Sunday→Monday logic
- `nthWeekdayInMonth(nth, weekday, month, year)`: Calculate nth occurrence of weekday in month
- `lastWeekdayInMonth(weekday, month, year)`: Calculate last occurrence of weekday in month
- `isSameDay(a, b)`: Compare dates ignoring time

### 4.4 Countdown Formatter (countdownFormatter.ts)

#### `formatCountdown(intervalSeconds: number): string`
**Purpose**: Convert seconds to human-readable countdown
**Examples**:
- 3661s → "1h 1m remaining"
- 90061s → "1d 1h remaining"
- -300s → "Sweep completed"
- 0 → "Sweeping in progress"

**Output**: User-friendly string

### 4.5 Constants (constants.ts)

#### Map Colors
```typescript
MAP_COLORS = {
    red: "#EF4444",      // Sweeping today
    orange: "#F97316",   // Sweeping tomorrow
    yellow: "#EAB308",   // Sweeping in 3 days
    green: "#22C55E",    // Safe
    gray: "#9CA3AF"      // No data
}
```

#### City Configurations
```typescript
CITY_CONFIGS = {
    sf: {
        code: "sf",
        name: "San Francisco",
        center: { lat: 37.7749, lng: -122.4194 },
        bounds: { latMin: 37.7034, latMax: 37.8332, lngMin: -122.527, lngMax: -122.3569 },
        colors: MAP_COLORS
    }
    // Future: la, nyc, etc.
}
```

#### Notification Settings
```typescript
DEFAULT_NOTIFICATION_LEAD_MINUTES_SET = [
    48 * 60,   // 2 days (2880 min)
    24 * 60,   // 1 day  (1440 min)
    4 * 60,    // 4 hours (240 min)
    2 * 60     // 2 hours (120 min)
]

CUSTOM_NOTIFICATION_LEAD_OPTIONS = [
    { label: "72 hours", value: 72 * 60 },
    { label: "48 hours", value: 48 * 60 },
    // ... down to 30 minutes
]
```

---

## 5. Backend (`@repo/backend`)

### Overview
Convex provides a TypeScript-native serverless database with real-time subscriptions, eliminating need for traditional REST API boilerplate.

### 5.1 Database Schema (schema.ts)

#### streetSegments Table
```typescript
{
    segmentId: string,                    // Unique ID (indexed)
    cnn: string,                          // CNN from SF data
    streetName: string,                   // Street name (full-text searchable)
    blockSide: string,                    // "North", "SouthEast", etc.
    limits: string,                       // "Larkin St - Polk St"
    coordinates: Coordinate[],            // { latitude, longitude }[] polyline
    bounds: Bounds,                       // { latMin, latMax, lngMin, lngMax }
    rules: SweepingRule[]                 // Array of sweeping rules
}
Indexes:
  - by_segmentId (for single-record queries)
  - by_streetName (for name-based lookups)
  - search_streetName (full-text search)
```

**Data Size**: ~37,856 segments (SF street grid), ~2-5 rules per segment

#### parkedCars Table
```typescript
{
    deviceId: string,                     // Device UUID (indexed, unique per device)
    latitude: number,
    longitude: number,
    streetName: string | null,            // Auto-populated from nearest segment
    parkedAt: number,                     // Unix timestamp (ms)
    notificationLeadMinutes: number,      // Legacy single value
    notificationLeadMinutesSet: number[],  // New: multiple lead times
    segmentId: string | null              // Associated segment
}
Index: by_deviceId (upsert pattern)
```

#### userPreferences Table
```typescript
{
    deviceId: string,                     // (indexed)
    hasSeenDisclaimer: boolean,           // Disclaimer acknowledgment
    notificationLeadMinutes: number,      // Legacy single value
    notificationLeadMinutesSet: number[],  // New: supports multiple leads
    activeCityCode: string | null         // Future: supports multi-city
}
Index: by_deviceId
```

### 5.2 Queries

#### `getSegmentsInBounds(latMin, latMax, lngMin, lngMax): StreetSegment[]`
**Purpose**: Fetch street segments within a map viewport (bounding box)
**Implementation**: Filters by comparing segment bounds against query bounds
**Limitations**: Convex lacks native geo indexes, so query fetches up to 500 segments and filters
**Returns**: Array of segments (usually 50-200 for a SF viewport)

#### `getSegmentById(segmentId): StreetSegment | null`
**Purpose**: Fetch a single segment by ID
**Uses**: Index for O(1) lookup
**Use Case**: Display street detail when user taps a street

#### `searchStreets(query): StreetSegment[]`
**Purpose**: Full-text search for streets by name
**Example**: "market" → finds "Market Street", "Market St", etc.
**Returns**: Top 10 results

#### `findNearestSegment(latitude, longitude): StreetSegment | null`
**Purpose**: Find the closest street to a given coordinate
**Algorithm**:
1. Search small bounding box (~0.005° ≈ 500m radius)
2. Fetch up to 100 candidate segments
3. Calculate Euclidean distance to each coordinate point
4. Return closest segment

**Use Case**: Auto-populate street name when user clicks "I Parked Here"

### 5.3 Mutations

#### `parkCar({ deviceId, latitude, longitude, streetName?, notificationLeadMinutesSet?, segmentId? }): _id`
**Purpose**: Create/update parked car (upsert)
**Logic**:
1. Find existing record for deviceId
2. Delete old record if exists
3. Insert new record with parkedAt = Date.now()
**Returns**: Convex document ID

#### `updateParkedLocation({ deviceId, latitude, longitude, streetName?, segmentId? }): _id | null`
**Purpose**: Update parking location (user dragged pin on map)
**Logic**: Patch existing record with new coordinates
**Returns**: Document ID or null if no parked car found

#### `clearParkedCar({ deviceId }): void`
**Purpose**: Remove parked car entry (user cleared parking)
**Logic**: Find and delete record

#### `setPreferences({ deviceId, hasSeenDisclaimer?, notificationLeadMinutes?, notificationLeadMinutesSet?, activeCityCode? }): _id`
**Purpose**: Update user preferences (upsert)
**Logic**:
1. Find existing preferences
2. If exists: patch only provided fields
3. If not exists: insert with defaults (hasSeenDisclaimer=false, notificationLeadMinutes=60)

### 5.4 Data Seeding (seed.ts)

**Script**: `npx convex run seed:seedFromCSV`
**Purpose**: Parse SF street sweeping CSV and populate streetSegments table
**Dependencies**: csv-parse package for CSV processing
**Input**: Street_Sweeping_Schedule_*.csv
**Processing**:
1. Read CSV file
2. Parse rows into StreetSegment objects with SweepingRule arrays
3. Calculate bounds for each segment
4. Batch insert into Convex database

---

## 6. Web App (`apps/web`)

### 6.1 Architecture
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4.0.0
- **State**: Convex React hooks (useQuery, useMutation, useConvex)
- **Maps**: MapLibre GL + react-map-gl 7.1.0

### 6.2 Core Routes

#### `src/app/page.tsx` (Home)
**Features**:
- Interactive map with polyline-rendered streets
- "I Parked Here" button (fixed position, bottom center)
- Search bar (top)
- Legend (color codes explanation)
- Parking status card (when car parked)
- Notification settings modal

**State Management**:
- `bounds`: Current map viewport (Bounds)
- `selectedSegment`: Tapped street (SelectedSegment | null)
- `segments`: Map data from getSegmentsInBounds query
- `parkedCar`: Current parking location (ConvexQuery)
- `preferences`: User settings (ConvexQuery)

**User Flows**:
1. **Park car**: Click "I Parked Here" → capture GPS → find nearest segment → call `parkCar()` mutation → display ParkingCard
2. **View street**: Click street on map → navigate to street-detail
3. **Search**: Type in SearchBar → call `searchStreets()` → show results → click to view details
4. **Adjust parking**: Drag marker → call `updateParkedLocation()`
5. **Clear parking**: Click "Clear" on card → call `clearParkedCar()`

### 6.3 Key Components

#### `<Map>` (src/components/Map.tsx)
- Renders MapLibre canvas with polylines for each segment
- Colors segments based on `getMapColorStatus(segment.rules)`
- Handles map region changes
- Renders user location (blue dot) and parked car (red pin)
- Tap/click handlers for segment selection

#### `<ParkingCard>` (src/components/ParkingCard.tsx)
- Displays current sweeping status (with live countdown)
- Shows notification lead time options
- "Clear Parking" button
- Opens NotificationSettingsModal

#### `<SearchBar>` (src/components/SearchBar.tsx)
- Text input with autocomplete
- Queries `searchStreets()` on input
- Navigates to street detail on selection

#### `<DisclaimerModal>` (src/components/DisclaimerModal.tsx)
- One-time legal disclaimer
- Shows on first app load if `hasSeenDisclaimer === false`
- Accept button sets `hasSeenDisclaimer = true` in preferences

#### `<Legend>` (src/components/Legend.tsx)
- Shows color meanings (red=today, orange=tomorrow, etc.)
- Fixed position on map

### 6.4 Hooks

#### `useDeviceId()` (src/hooks/useDeviceId.ts)
- Generates and caches unique device ID (localStorage)
- Returns string UUID for server-side identification (since web has no AuthN)

---

## 7. Mobile App (`apps/mobile`)

### 7.1 Architecture
- **Framework**: Expo 54.0.0 with React Native
- **Router**: Expo Router 4.0.0 (file-based, like Next.js)
- **Styling**: Tailwind CSS 4.0 + Uniwind (cross-platform)
- **Maps**: react-native-maps 1.20.1 (native Google Maps)
- **State**: Convex React hooks + local caching (Expo SecureStore)
- **Notifications**: expo-notifications 0.30.0
- **Location**: expo-location 18.0.0

### 7.2 File-Based Routes

#### `app/index.tsx` (Home Screen)
**The main application screen with most complex logic**

**Key Responsibilities**:
1. **Map Display**: Render MapDisplay component with all cached + live segments
2. **Convex Integration**: Query segments in viewport bounds, parked car state, user preferences
3. **Caching Strategy**:
   - Hybrid: Load cached segments from SecureStore on startup
   - Then: Fetch fresh data from Convex for current viewport
   - Merge both sources to minimize loading
4. **Parking Workflow**:
   - "I Parked Here" button captures GPS location
   - Finds nearest street segment
   - Schedules notifications
   - Persists locally + to backend
5. **Notification Scheduling**:
   - Multiple lead times (48h, 24h, 4h, 2h by default)
   - Uses expo-notifications to schedule local notifications
   - Updates backend preferences

**State Variables** (Complex):
```typescript
const [bounds, setBounds] = useState<Bounds>
const [cachedSegments, setCachedSegments] = useState<Segment[]>
const [cacheHydrated, setCacheHydrated] = useState<boolean>
const [localParkedCar, setLocalParkedCar] = useState<LocalParkedCarSnapshot | null>
const [localLeadMinutesSet, setLocalLeadMinutesSet] = useState<number[]>
const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>

// Convex queries
const segmentsQuery = useQuery(api.streets.getSegmentsInBounds, bounds)
const parkedCarQuery = useQuery(api.parking.getParkedCar, ...)
const preferencesQuery = useQuery(api.preferences.getPreferences, ...)

// Convex mutations
const parkCar = useMutation(api.parking.parkCar)
const updateLocation = useMutation(api.parking.updateParkedLocation)
const clearCar = useMutation(api.parking.clearParkedCar)
const setPrefs = useMutation(api.preferences.setPreferences)
```

**Data Flow** (Complex):
1. On mount: Load cache from SecureStore
2. Convex queries fetch live data
3. Merge cached + live for UI rendering
4. When user parks:
   - Call `parkCar()` mutation
   - Update local state
   - Save to SecureStore for offline access
   - Schedule notifications

#### `app/_layout.tsx` (Root Layout)
- Wraps app with ConvexProvider
- Sets up notification handler
- Configures Expo Router Stack
- Handles missing EXPO_PUBLIC_CONVEX_URL error state

#### `app/street-detail.tsx` (Street Detail Modal)
- Shows detailed rules for a specific street
- Lists all sweeping rules with times and week patterns
- Next sweeping countdown

### 7.3 Components

#### `<MapDisplay>` (src/components/MapDisplay.tsx)
```typescript
interface MapDisplayProps {
    segments: Segment[];
    parkedLocation: { latitude, longitude } | null;
    userLocation: { latitude, longitude } | null;
    onRegionChange: (region: Region) => void;
    onSegmentPress: (segmentId: string) => void;
    onParkedLocationDragEnd?: (location) => void;
    cityCode?: string;
}
```
- Renders react-native-maps MapView
- Polylines for each segment (color-coded by status)
- Draggable marker for parked car
- User location (blue dot)
- Handles region changes for bounds queries

#### `<ParkingCard>` (src/components/ParkingCard.tsx)
- Shows sweeping status with live countdown (updates every 1 second)
- Notification lead time options with abbreviations (48h, 24h, 4h, 2h)
- "Clear" button
- Tap for notification settings

#### `<SearchBar>` (src/components/SearchBar.tsx)
- Local search against all cached/live segments
- Autocomplete from streetName field
- No Convex query (searches in-app to avoid latency)

#### `<Legend>` (src/components/Legend.tsx)
- Fixed absolute positioning
- Color explanation

#### `<DisclaimerModal>` (src/components/DisclaimerModal.tsx)
- Full-screen overlay
- Legal disclaimer text (from constants)
- "I Understand" button sets hasSeenDisclaimer in preferences

#### `<NotificationSettingsModal>` (src/components/NotificationSettingsModal.tsx)
- Allows user to customize notification lead times
- Checkboxes for predefined options (48h, 24h, 4h, 2h)
- Custom input field for other values
- "Save Default" resets to preset schedule
- "Open System Settings" links to iOS Settings

#### `<StreetDetail>` (src/components/StreetDetail.tsx)
- Modal sheet showing street details
- Street name, limits, CNN
- All sweeping rules formatted nicely
- Next sweeping countdown

### 7.4 Data Persistence

#### `src/data/localStore.ts`
Uses `expo-secure-store` for encrypted local storage:
- `loadLocalParkedSnapshot(deviceId)`: Retrieve cached parked car state
- `saveLocalParkedSnapshot(deviceId, snapshot)`: Cache parked car
- `loadLocalLeadMinutesSet(deviceId)`: Retrieve cached notification settings
- `saveLocalLeadMinutesSet(deviceId, leads)`: Cache notification settings
- `loadScheduledNotificationIds()`: Track active notifications for cleanup

#### `src/data/segmentCache.ts`
Caches street data across app sessions:
- `loadSegmentCache(cityCode)`: Load all segments from persisted storage
- `saveSegmentCache(cityCode, segments)`: Persist after fresh fetch
- Uses FileSystem API for large JSON (faster than SecureStore)

#### `src/data/offlineTiles.ts`
Future feature for offline map tiles (MapBox format)

### 7.5 Services

#### `src/services/notifications.ts`
Manages push notification lifecycle:
```typescript
// Request permissions with iOS-specific options
ensureParkingNotificationPermissions(): Promise<boolean>

// Schedule multiple notifications at different lead times
scheduleParkingNotifications({
    streetName: "Market Street",
    sweepStartTime: Date,
    leadMinutesSet: [2880, 1440, 240, 120]  // 48h, 24h, 4h, 2h
}): Promise<void>

// Cancel all scheduled notifications
cancelScheduledParkingNotifications(): Promise<void>

// Open iOS Settings app
openSystemNotificationSettings(): Promise<void>
```

**Implementation**:
- Uses `expo-notifications` with LocalNotification (scheduled on-device, not via APNs)
- For each lead time: schedules a notification at (sweepStartTime - leadMinutes)
- Stores notification IDs in SecureStore for later cancellation
- Uses Android WorkManager equivalent for background scheduling

### 7.6 Hooks

#### `useDeviceId()` (src/hooks/useDeviceId.ts)
- Generates random UUID on first app launch
- Caches in SecureStore
- Returns string for server identification

#### `useLocation()` (src/hooks/useLocation.ts)
- Requests foreground location permission (iOS/Android)
- Uses expo-location to poll current position
- Returns { latitude, longitude } or null
- Used as fallback for "I Parked Here" button

---

## 8. Feature List

### 8.1 Interactive Map
**Platforms**: Web, Mobile

**Purpose**: Visual representation of street sweeping schedules across San Francisco

**Features**:
- Polyline rendering of street segments
- Color-coded streets:
  - Red: Sweeping today
  - Orange: Sweeping tomorrow
  - Yellow: Sweeping within 3 days
  - Green: Safe (3+ days or never)
  - Gray: No data
- Pan & zoom interaction
- Current location (blue dot)
- User location tracking (if granted)

**Dependencies**: sweepingRuleEngine.getMapColorStatus(), shared types

**Edge Cases**:
- Extreme zoom levels (too zoomed in = no segments visible)
- City boundary handling
- Large viewport requests (capped at 500 segments)

---

### 8.2 I Parked Here
**Platforms**: Web, Mobile

**Purpose**: Capture user's parking location with one tap

**Workflow**:
1. User taps "I Parked Here" button
2. App captures GPS location (or falls back to city center if denied)
3. Backend queries findNearestSegment to identify street
4. App displays ParkingCard with sweeping status
5. Notifications are scheduled immediately

**Data Captured**:
- latitude, longitude
- parkedAt (timestamp)
- streetName (auto-resolved)
- segmentId (for fast rule lookups)
- notificationLeadMinutesSet

**Backend Flow**:
- `parkCar()` mutation (creates/updates parkedCars table)
- Subsequent `getParkedCar()` queries fetch current state
- Subscriptions update UI in real-time

**Constraints**:
- One parked car per device (upsert pattern)
- GPS required (or fallback to city center)
- Notifications only trigger if permission granted

---

### 8.3 Manual Parking Pin Adjustment
**Platforms**: Web, Mobile

**Purpose**: Allow users to correct their parking location if GPS was inaccurate

**Interaction**:
- User long-presses/drags parked car marker on map
- On drag-end: calls `updateParkedLocation()` mutation
- Re-queries nearest segment to update street name
- Notifications re-scheduled with new location

**Backend**:
- `updateParkedLocation()` patches coordinates + streetName + segmentId
- Atomic operation (no race conditions in Convex)

---

### 8.4 Sweeping Status Display
**Platforms**: Web, Mobile

**Purpose**: Show user whether their parked car is safe or at risk

**States Displayed**:
- "Safe to park" — No sweeping planned
- "Sweeping Today" — Alert with time countdown
- "Imminent" — Orange alert (within 1 hour)
- "Sweeping in Progress" — Red alert
- "Upcoming" — Next sweeping date/time
- "No Data" — Street not in database

**Countdown**: Live-updates every 1 second on mobile/web

**Implementation**: ParkingCard component + formatCountdown()

---

### 8.5 Notification Scheduling
**Platforms**: Mobile (iOS/Android)

**Purpose**: Send local push notifications before sweeping

**Default Schedule**:
- 48 hours before sweep
- 24 hours before sweep
- 4 hours before sweep
- 2 hours before sweep

**User Customization**:
- NotificationSettingsModal allows adding/removing lead times
- Persisted in userPreferences.notificationLeadMinutesSet
- Can reset to defaults

**Implementation**:
- expo-notifications.scheduleNotificationAsync() for each lead time
- Local notifications (don't require APNs setup)
- Scheduled IDs tracked for cancellation on app exit

**Mobile-Only Reason**: Web PWA would need different notification stack (Service Workers + Notifications API), not yet implemented

---

### 8.6 Search Streets
**Platforms**: Web, Mobile

**Purpose**: Quick lookup of a specific street's sweeping schedule

**Web Flow**:
1. Type in SearchBar
2. Convex `searchStreets(query)` query
3. Display top 10 results
4. Tap result → navigate to street-detail

**Mobile Flow**:
1. Type in SearchBar
2. Local search against in-memory segment array (no Convex query)
3. Display matching results
4. Tap result → push to street-detail route

**Performance**: 
- Web: ~100ms Convex query
- Mobile: ~1ms local filter (instant)

---

### 8.7 Street Detail View
**Platforms**: Web, Mobile

**Purpose**: Show all sweeping rules for a specific street

**Data Displayed**:
- Street name + limits
- CNN identifier
- All SweepingRule objects formatted:
  - "Every Monday, 8am-11am"
  - "1st & 3rd Thursdays, 9am-12pm"
  - Holidays: "Applies on holidays" or "No sweeping on holidays"
- Next sweeping countdown

**Navigation**:
- Web: Modal overlay
- Mobile: Expo Router screen (street-detail.tsx)

---

### 8.8 Disclaimer Modal
**Platforms**: Web, Mobile

**Purpose**: Legal disclosure about data accuracy

**Trigger**: First app launch (if hasSeenDisclaimer === false)

**Content**: Legal text from constants.DISCLAIMER_TEXT

**Action**: "I Understand" → sets hasSeenDisclaimer = true in preferences

---

### 8.9 Notification Settings
**Platforms**: Mobile

**Purpose**: Customize notification timing

**Options**:
- Predefined schedule (48h, 24h, 4h, 2h)
- Custom input for arbitrary minutes
- "Save Default" to reset
- "Open System Settings" to grant iOS permissions

**Backend Sync**: Saves to userPreferences.notificationLeadMinutesSet

---

### 8.10 Multi-City Support (Future)
**Platforms**: Web, Mobile

**Architecture Ready**: activeCityCode in userPreferences

**Data Model**:
- CITY_CONFIGS in constants supports N cities
- Each city has separate bounds, color scheme, data
- Backend can support multiple street datasets

**Future Cities**: LA (37K segments), NYC, etc.

---

## 9. Key Commands

### Development

**Start all dev servers**:
```bash
bun run dev
```

**Start web only** (localhost:3000):
```bash
bun run dev:web
```

**Start mobile** (Expo Go):
```bash
bun run dev:mobile
```

**Start backend** (Convex dev server, localhost:3210):
```bash
bun run dev:backend
```

### Building & Deployment

**Build all packages**:
```bash
bun run build
```

**Deploy backend to Convex**:
```bash
cd packages/backend && npx convex deploy
```

**Seed street data to backend**:
```bash
cd packages/backend && npx convex run seed:seedFromCSV
```

**Build iOS app** (EAS):
```bash
cd apps/mobile && npx eas build --platform ios
```

### Testing & Quality

**Run all tests** (Vitest):
```bash
bun run test
```

**Test shared package only**:
```bash
cd packages/shared && bun run test:watch
```

**Lint all packages**:
```bash
bun run lint
```

**Type check all packages**:
```bash
bun run typecheck
```

---

## 10. Testing

### Setup
- **Test Runner**: Vitest 3.0.0
- **Only in shared package** (core logic): sweepingRuleEngine, holidayCalculator, formatCountdown
- **No tests in apps**: Web & Mobile lack automated tests (design choice: manual QA)

### Shared Package Test Structure
```typescript
// Example: sweepingRuleEngine.test.ts
describe("ruleAppliesTo", () => {
  test("applies when dayOfWeek matches and no week restriction", () => {
    const rule = { dayOfWeek: 2, ... }  // Monday
    const date = new Date(2025, 0, 13)  // Monday, Jan 13, 2025
    expect(ruleAppliesTo(rule, date)).toBe(true)
  })
  
  test("skips if holiday and !applyOnHolidays", () => {
    const rule = { ..., applyOnHolidays: false }
    const newYears = new Date(2025, 0, 1)  // Jan 1
    expect(ruleAppliesTo(rule, newYears)).toBe(false)
  })
})
```

### Test Patterns
- Unit tests for pure functions (ruleAppliesTo, getStatus, getMapColorStatus)
- Edge cases: holidays, leap years, week-of-month boundaries
- No mocking needed (all functions deterministic)

---

## 11. Current State & Known Issues

### Implemented (Production-Ready)
✅ Convex backend schema + API (streets, parking, preferences)
✅ Shared business logic (sweepingRuleEngine, holidayCalculator)
✅ Mobile app (Expo) with map, parking, notifications
✅ Web app (Next.js) with map, parking card
✅ Local caching (SecureStore on mobile, browser storage on web)
✅ City configuration framework (SF only, multi-city ready)

### In Progress / Future
⏳ iOS App Store submission (pending production readiness checklist)
⏳ Android Play Store submission
⏳ Notification permissions flow (iOS 13+ requires explicit permission request)
⏳ Offline tile caching (offline-tiles.ts started)

### Known Limitations
- **Web notifications**: No push notifications (would require Service Worker + HTTPS)
- **Multi-city data**: Only SF street data loaded, but architecture supports expansion
- **Real-time collab**: No user accounts/auth (device-ID based, anonymous)
- **Premium features**: No subscription model

---

## 12. Architecture Decisions & Rationale

### Convex (vs. traditional REST API)
**Why**: 
- Real-time subscriptions out-of-the-box (mobile/web auto-update when data changes)
- No API boilerplate (Convex handles HTTP layer)
- Automatic optimistic updates
- Type-safe: TypeScript schema → generated client types

### Expo (vs. native iOS/Android)
**Why**:
- Code reuse between iOS/Android (70% shared)
- Faster development cycle
- JavaScript ecosystem libraries
- Over-the-air updates (Expo Updates)

**Tradeoff**: Can't access some advanced iOS features (e.g., background location) without prebuild

### Shared TypeScript Logic
**Why**:
- sweepingRuleEngine, holidayCalculator, types shared across all platforms
- Eliminates bugs from reimplementing logic in Swift/Kotlin/JavaScript
- Single source of truth for business rules

### Multiple Notification Lead Times
**Why**:
- User research showed different preferences (some want 48h warning, others want 2h)
- Default set chosen based on iOS TestFlight feedback
- Backward compatible with legacy single-value preference

---

## 13. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    San Francisco                            │
│              37,856 Street Segments                         │
│                  (CSV imported)                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Convex Backend                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ streetSegments (37.8K docs, 2-5 rules per segment)  │   │
│  │ parkedCars (1 per device)                           │   │
│  │ userPreferences (1 per device)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                     ↑ & ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Queries (reads) & Mutations (writes)                │   │
│  │ + Real-time subscriptions via useQuery             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
       ↗                                              ↖
      /                                                \
  [Mobile App]                                    [Web App]
  (Expo/RN)                                      (Next.js)
   + ─────────────────────────────────────────────────────+
   │ Shared Package (@repo/shared)                       │
   │  • sweepingRuleEngine.ts                            │
   │  • holidayCalculator.ts                             │
   │  • types.ts, constants.ts                           │
   │  • (runs in both apps)                              │
   +─────────────────────────────────────────────────────+
   │                                                     │
   ├─ MapDisplay (with color-coded polylines)           │
   ├─ ParkingCard (live countdown, notifications)       │
   ├─ SearchBar (search streets)                        │
   ├─ DisclaimerModal (legal notice)                    │
   ├─ NotificationSettingsModal (customize timing)      │
   │                                                     │
   └─ Local Cache (SecureStore, filesystem)             │
```

---

## 14. Feature Requirements Summary Table

| Feature | Purpose | Platforms | Dependencies | Status |
|---------|---------|-----------|--------------|--------|
| Interactive Map | Visual sweeping schedule | Web, Mobile | maplibre-gl, react-native-maps, sweepingRuleEngine | ✅ Complete |
| I Parked Here | Capture parking location | Web, Mobile | expo-location, parkCar mutation | ✅ Complete |
| Manual Pin Adjust | Correct GPS errors | Web, Mobile | updateParkedLocation mutation | ✅ Complete |
| Sweeping Status | Show safe/at-risk state | Web, Mobile | getStatus() | ✅ Complete |
| Notifications (Mobile) | Advance reminders | Mobile | expo-notifications, scheduleParkingNotifications | ✅ Complete |
| Search Streets | Look up street rules | Web, Mobile | searchStreets query | ✅ Complete |
| Street Detail | Show all rules for street | Web, Mobile | getSegmentById query | ✅ Complete |
| Disclaimer | Legal disclosure | Web, Mobile | DisclaimerModal | ✅ Complete |
| Notification Settings | Customize lead times | Mobile | NotificationSettingsModal | ✅ Complete |
| Multi-City Support | Future expansion | Web, Mobile | CITY_CONFIGS, activeCityCode | ⏳ Architecture ready, no data |
| Offline Map Tiles | Work without connectivity | Mobile | offlineTiles.ts | ⏳ Skeleton only |

---

## 15. Conclusion

The EasyStreet monorepo is a **modern, type-safe, cross-platform application** built on cutting-edge technologies:

- **Shared logic** across iOS/Android/Web via TypeScript
- **Real-time backend** with Convex eliminates REST API complexity
- **Hybrid caching** strategy for offline support on mobile
- **Extensible architecture** for multi-city expansion
- **Accessible UX** with color-coding, location services, notifications

**Next Phase**: Transition from development to production (App Store/Play Store submission, real-time data updates, user acquisition).