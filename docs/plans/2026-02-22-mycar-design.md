# MyCar — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyCar** — Your car's logbook. Private, offline, forever.

A vehicle maintenance and fuel tracking app for privacy-conscious car owners who want to log service history, track fuel economy, manage maintenance reminders, and store vehicle documents — all without GPS tracking, insurance data sharing, or subscription fees. Multi-vehicle support for households. One-time purchase. Your driving data is yours.

---

## 2. Problem Statement

Every car owner needs to track maintenance, but the current options all compromise on privacy or pricing:

1. **Drivvo** — Free tier with ads, premium removes ads and adds features. Requires account creation. Data stored on their servers. Uses device location permissions. Runs analytics and ad tracking SDKs.

2. **Simply Auto** — $10/year subscription for full features. Cloud-synced data requires account. Better than Drivvo but still collects data and requires ongoing payment for what should be a simple logbook.

3. **FIXD** — $20 OBD-II dongle + $7/month subscription for "premium" features. The hardware is useful but the subscription model for basic diagnostic code lookups is predatory. Shares aggregated vehicle data.

4. **Jerry / Carvana / Carfax** — These apps want your VIN, mileage, and maintenance history to sell you insurance quotes and upsell services. The "free maintenance tracking" is a data acquisition funnel.

**The gap:** No maintenance tracker treats your vehicle data as private by default. Every competitor either harvests your data, requires cloud accounts, or charges subscriptions. Car owners deserve a simple logbook that works offline and doesn't share their data with insurance companies, dealerships, or advertisers.

**Secondary problem:** When selling a car, buyers want to see documented maintenance history. Current tools make it hard to generate a clean, professional service record. MyCar solves this with one-tap PDF export.

---

## 3. Target User Persona

### Primary: "DIY Dave" — Hands-On Car Enthusiast

- **Age:** 28-55
- **Context:** Owns 1-3 vehicles, does some maintenance himself, takes others to independent mechanics. Tracks oil changes, tire rotations, brake jobs. Cares about resale value.
- **Current tools:** Spreadsheet, notes app, shoebox of receipts, or nothing (memory)
- **Pain points:** Can't remember when the last oil change was. Loses receipts. Mechanic asks "when was the timing belt done?" and he can't answer. Doesn't trust apps that want GPS access.
- **Willingness to pay:** $5 for an app that replaces his spreadsheet? Absolutely.
- **Where they hang out:** r/cars, r/MechanicAdvice, r/Cartalk, r/AutoDetailing, r/Frugal, car-specific subreddits (r/Honda, r/Toyota, etc.), YouTube mechanic channels

### Secondary: "Family Fleet Fiona" — Multi-Vehicle Household Manager

- **Age:** 30-50
- **Context:** Manages maintenance for 2-4 family vehicles (her car, partner's car, teenager's car, maybe a truck/RV). Needs reminders so nothing falls through the cracks.
- **Pain points:** Tracking different maintenance schedules across multiple vehicles is chaos. Oil change intervals differ. Tire sizes differ. Registration renewal dates differ.
- **Willingness to pay:** $5 to manage the family fleet? No-brainer.

### Tertiary: "Resale Rick" — Selling a Car

- **Age:** Any
- **Context:** About to sell a car and wants to document its maintenance history to justify the asking price.
- **Use case:** Enter all past maintenance (possibly from memory/receipts), generate a professional PDF, include in the car listing.
- **Entry point:** Downloads MyCar specifically to create a maintenance history document.

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | OBD Required | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|--------------|
| **Drivvo** | Free + $5/yr premium | 5M+ | ~$5M/yr | Ads + analytics, cloud storage | No | Ad-supported, data harvesting |
| **Simply Auto** | $10/yr | 2M+ | ~$10M/yr | Cloud-synced, requires account | No | Subscription for basic logging |
| **FIXD** | $20 dongle + $7/mo | 3M+ | ~$30M/yr | Shares aggregated vehicle data | Yes (OBD-II) | Hardware required, expensive subscription |
| **Fuelly** | Free | 1M+ | ~$1M/yr (ads) | Ad-supported, limited privacy | No | Fuel-only, no maintenance |
| **AUTOsist** | $6/yr | 500K+ | ~$2M/yr | Cloud-synced | No | Dated UI, limited features |
| **aCar** | $3 one-time | 1M+ | ~$3M total | Better (local option) | No | Android-only, abandoned development |
| **MyCar** | **$4.99 one-time** | **0 (launch)** | **TBD** | **Local-only, zero telemetry** | **No** | **New, no community** |

### Competitive Advantages

1. **Privacy:** No GPS, no VIN upload, no insurance data sharing. Your maintenance log is yours.
2. **Price:** $4.99 once vs $60-120/year. No hardware required.
3. **Multi-vehicle:** First-class multi-car support with per-vehicle dashboards.
4. **PDF Export:** One-tap professional maintenance history for resale — no competitor does this well.
5. **Offline-first:** Works in the garage, at the gas station, anywhere. No account needed.
6. **Photo receipts:** Snap service receipts and attach them to log entries for proof.

---

## 5. Key Features (MVP)

### 5.1 Vehicle Profiles
- Add multiple vehicles with: year, make, model, trim, color, VIN (optional), license plate, photo
- Per-vehicle odometer tracking (current mileage, updated with each log entry)
- Vehicle nickname for quick identification ("Mom's Civic", "The Truck")
- Quick-switch between vehicles via horizontal scroll or dropdown
- Vehicle summary card: next service due, last fill-up MPG, total expenses

### 5.2 Maintenance Log
- Log service events: date, odometer, service type, cost, location (free text, no GPS), notes
- Pre-defined service types with suggested intervals:
  - Oil change (every 5,000-7,500 mi or 6 months)
  - Tire rotation (every 5,000-7,500 mi)
  - Brake pad replacement (every 25,000-70,000 mi)
  - Air filter (every 15,000-30,000 mi)
  - Transmission fluid (every 30,000-60,000 mi)
  - Coolant flush (every 30,000-50,000 mi)
  - Spark plugs (every 30,000-100,000 mi)
  - Timing belt (every 60,000-100,000 mi)
  - Battery replacement (every 3-5 years)
  - Wiper blades (every 6-12 months)
  - Cabin air filter (every 15,000-25,000 mi)
  - Custom service type (user-defined)
- Attach photos to entries (service receipts, before/after photos, damage documentation)
- Sort and filter by: date, service type, cost
- Edit and delete entries

### 5.3 Maintenance Reminders
- Create reminders by mileage interval OR date interval (or both)
- Reminders auto-calculate from last logged service + interval
- Local push notifications when a reminder comes due
- Reminder states: upcoming (green), due soon (amber), overdue (red)
- Dashboard shows next 5 upcoming services across all vehicles
- Snooze or dismiss reminders
- Pre-configured reminder templates based on manufacturer recommendations (generic)

### 5.4 Fuel Tracking
- Log fill-ups: date, odometer, gallons/liters, price per unit, total cost, full tank (Y/N), station (free text)
- Automatic MPG/L-per-100km calculation between fill-ups (requires consecutive full-tank fills)
- Fuel economy trend chart (line, last 20 fill-ups)
- Average cost per mile/km
- Monthly fuel expense summary
- Support for both US (MPG, gallons) and metric (L/100km, liters) units

### 5.5 Expense Tracking
- Aggregate all costs: maintenance + fuel + other (insurance, parking, tolls, registration, car wash)
- Monthly and yearly expense summaries
- Cost breakdown by category (pie chart)
- Per-vehicle total cost of ownership
- Export expense report (CSV)

### 5.6 Document Storage
- Store vehicle documents as photos: insurance cards, registration, VIN sticker, title
- Document types with expiration tracking: insurance (expiry date), registration (renewal date)
- Reminders for document renewals
- Quick-access document viewer (flip through stored cards)

### 5.7 Service History Export (PDF)
- Generate a professional PDF of complete maintenance history for a vehicle
- Includes: vehicle info, chronological service log, mileage at each service, costs
- Clean, printable layout suitable for car buyers
- Share via system share sheet (email, AirDrop, Messages, etc.)
- "Maintenance Record" branding — looks professional, not app-branded

### 5.8 Settings
- Units: US (miles, gallons, MPG) or Metric (km, liters, L/100km)
- Currency: USD, EUR, GBP, CAD, AUD (symbol + formatting)
- Appearance: dark mode (default), light mode, system
- Data: export all data (JSON backup), import backup, clear all data
- Reminders: notification preferences, default intervals

---

## 6. Technical Architecture

### 6.1 Stack

- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 — manage vehicles from desktop
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Charts:** Victory Native (mobile), Recharts (web)
- **PDF Generation:** `react-native-html-to-pdf` (mobile), `@react-pdf/renderer` (web)
- **Image Storage:** expo-file-system (images stored in app document directory)
- **Notifications:** expo-notifications (local push only, no server)
- **Camera:** expo-image-picker (photo capture for receipts/documents)

### 6.2 Monorepo Structure

```
MyCar/
├── apps/
│   ├── mobile/                # Expo (React Native)
│   │   ├── app/               # Expo Router
│   │   │   ├── (tabs)/
│   │   │   │   ├── garage/    # Vehicle list + vehicle detail
│   │   │   │   ├── log/       # Add/view maintenance and fuel entries
│   │   │   │   ├── reminders/ # Upcoming reminders dashboard
│   │   │   │   ├── expenses/  # Expense tracking and charts
│   │   │   │   └── settings/  # App settings
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── VehicleCard.tsx
│   │   │   ├── ServiceEntry.tsx
│   │   │   ├── FuelEntry.tsx
│   │   │   ├── ReminderCard.tsx
│   │   │   ├── MPGChart.tsx
│   │   │   └── ExpensePie.tsx
│   │   └── assets/
│   └── web/                   # Next.js 15
│       ├── app/
│       │   ├── garage/
│       │   ├── log/
│       │   ├── expenses/
│       │   └── settings/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrations.ts
│   │   │   │   └── queries.ts
│   │   │   ├── models/        # Zod schemas and TypeScript types
│   │   │   ├── fuel/          # MPG calculation logic
│   │   │   │   ├── calculator.ts
│   │   │   │   └── units.ts
│   │   │   ├── reminders/     # Reminder scheduling logic
│   │   │   │   ├── scheduler.ts
│   │   │   │   └── intervals.ts
│   │   │   ├── export/        # PDF and CSV generation
│   │   │   │   ├── pdf-template.ts
│   │   │   │   └── csv-export.ts
│   │   │   └── constants/     # Service types, default intervals
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── theme.ts
│   │   │   └── ...
│   │   └── package.json
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── timeline.md
└── README.md
```

### 6.3 Data Model (SQLite Schema)

```sql
-- Vehicles
CREATE TABLE vehicles (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    nickname        TEXT DEFAULT '',
    year            INTEGER,
    make            TEXT NOT NULL,
    model           TEXT NOT NULL,
    trim            TEXT DEFAULT '',
    color           TEXT DEFAULT '',
    vin             TEXT DEFAULT '',
    license_plate   TEXT DEFAULT '',
    photo_path      TEXT DEFAULT '',          -- local file path to vehicle photo
    odometer        INTEGER NOT NULL DEFAULT 0,
    odometer_unit   TEXT NOT NULL DEFAULT 'miles' CHECK (odometer_unit IN ('miles', 'km')),
    fuel_unit       TEXT NOT NULL DEFAULT 'gallons' CHECK (fuel_unit IN ('gallons', 'liters')),
    is_active       INTEGER NOT NULL DEFAULT 1,
    position        INTEGER DEFAULT 0,       -- sort order
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Maintenance service log
CREATE TABLE service_log (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_type    TEXT NOT NULL,            -- 'oil_change', 'tire_rotation', 'custom', etc.
    custom_type     TEXT DEFAULT '',          -- user-defined type name when service_type='custom'
    date            TEXT NOT NULL,            -- YYYY-MM-DD
    odometer        INTEGER NOT NULL,
    cost            REAL DEFAULT 0.0,
    currency        TEXT NOT NULL DEFAULT 'USD',
    location        TEXT DEFAULT '',          -- free text, no GPS
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Photos attached to service log entries
CREATE TABLE service_photos (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    service_id      TEXT NOT NULL REFERENCES service_log(id) ON DELETE CASCADE,
    local_path      TEXT NOT NULL,            -- relative path in app document dir
    caption         TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fuel fill-ups
CREATE TABLE fuel_log (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,            -- YYYY-MM-DD
    odometer        INTEGER NOT NULL,
    quantity        REAL NOT NULL,            -- gallons or liters
    price_per_unit  REAL NOT NULL,
    total_cost      REAL NOT NULL,
    is_full_tank    INTEGER NOT NULL DEFAULT 1, -- boolean: 1=full fill, 0=partial
    station_name    TEXT DEFAULT '',          -- free text
    octane          TEXT DEFAULT '',          -- '87', '89', '91', '93', 'diesel', etc.
    notes           TEXT DEFAULT '',
    -- computed MPG/L100km (null if previous fill wasn't full tank)
    fuel_economy    REAL DEFAULT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Other expenses (insurance, parking, tolls, registration, etc.)
CREATE TABLE expenses (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    category        TEXT NOT NULL CHECK (category IN (
        'insurance', 'registration', 'parking', 'tolls',
        'car_wash', 'accessories', 'tickets', 'other'
    )),
    description     TEXT DEFAULT '',
    date            TEXT NOT NULL,            -- YYYY-MM-DD
    cost            REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    is_recurring    INTEGER NOT NULL DEFAULT 0,
    recurrence      TEXT DEFAULT '',          -- 'monthly', 'quarterly', 'yearly'
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Maintenance reminders
CREATE TABLE reminders (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_type    TEXT NOT NULL,
    custom_type     TEXT DEFAULT '',
    -- Trigger conditions (either or both)
    mileage_interval INTEGER DEFAULT NULL,    -- every N miles/km
    date_interval_days INTEGER DEFAULT NULL,  -- every N days
    -- Last baseline (from most recent service or manual set)
    last_odometer   INTEGER DEFAULT NULL,
    last_date       TEXT DEFAULT NULL,
    -- Computed next due
    next_odometer   INTEGER DEFAULT NULL,
    next_date       TEXT DEFAULT NULL,
    -- State
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'snoozed', 'dismissed')),
    snooze_until    TEXT DEFAULT NULL,
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vehicle documents (insurance cards, registration, etc.)
CREATE TABLE documents (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
        'insurance', 'registration', 'title', 'vin_sticker',
        'inspection', 'warranty', 'receipt', 'other'
    )),
    label           TEXT DEFAULT '',          -- user-friendly name
    local_path      TEXT NOT NULL,            -- photo/file path
    expiry_date     TEXT DEFAULT NULL,        -- YYYY-MM-DD for insurance/registration
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value)
CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_service_vehicle ON service_log(vehicle_id);
CREATE INDEX idx_service_date ON service_log(date DESC);
CREATE INDEX idx_service_type ON service_log(service_type);
CREATE INDEX idx_fuel_vehicle ON fuel_log(vehicle_id);
CREATE INDEX idx_fuel_date ON fuel_log(date DESC);
CREATE INDEX idx_expenses_vehicle ON expenses(vehicle_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_reminders_vehicle ON reminders(vehicle_id);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_documents_vehicle ON documents(vehicle_id);
CREATE INDEX idx_documents_expiry ON documents(expiry_date);
```

### 6.4 Fuel Economy Calculation

```typescript
interface FuelEconomyResult {
  value: number;         // e.g., 28.5
  unit: 'mpg' | 'l/100km' | 'km/l';
  distanceDriven: number;
  fuelUsed: number;
}

/**
 * MPG = distance driven / fuel consumed
 * Requires two consecutive full-tank fill-ups.
 * If a partial fill is logged between full fills, we accumulate
 * the fuel and compute economy across the span.
 */
function calculateFuelEconomy(
  currentFill: FuelEntry,
  previousFullFill: FuelEntry,
  partialFillsBetween: FuelEntry[],
  unitSystem: 'us' | 'metric'
): FuelEconomyResult | null {
  if (!currentFill.isFullTank || !previousFullFill.isFullTank) return null;

  const distance = currentFill.odometer - previousFullFill.odometer;
  if (distance <= 0) return null;

  const totalFuel = currentFill.quantity +
    partialFillsBetween.reduce((sum, f) => sum + f.quantity, 0);

  if (unitSystem === 'us') {
    return { value: distance / totalFuel, unit: 'mpg', distanceDriven: distance, fuelUsed: totalFuel };
  } else {
    return { value: (totalFuel / distance) * 100, unit: 'l/100km', distanceDriven: distance, fuelUsed: totalFuel };
  }
}
```

### 6.5 Reminder Scheduling Logic

```typescript
interface ReminderState {
  status: 'upcoming' | 'due_soon' | 'overdue';
  dueByOdometer: number | null;   // next mileage threshold
  dueByDate: Date | null;         // next date threshold
  daysUntilDue: number | null;
  milesUntilDue: number | null;
}

/**
 * Evaluate a reminder against current vehicle state.
 * A reminder is "due soon" if within 500 miles or 14 days.
 * A reminder is "overdue" if past the threshold.
 */
function evaluateReminder(
  reminder: Reminder,
  currentOdometer: number,
  today: Date
): ReminderState {
  let dueByOdometer: number | null = null;
  let dueByDate: Date | null = null;

  if (reminder.mileageInterval && reminder.lastOdometer != null) {
    dueByOdometer = reminder.lastOdometer + reminder.mileageInterval;
  }
  if (reminder.dateIntervalDays && reminder.lastDate) {
    dueByDate = addDays(new Date(reminder.lastDate), reminder.dateIntervalDays);
  }

  const milesUntilDue = dueByOdometer ? dueByOdometer - currentOdometer : null;
  const daysUntilDue = dueByDate ? differenceInDays(dueByDate, today) : null;

  // Overdue if either threshold is passed
  if ((milesUntilDue != null && milesUntilDue < 0) ||
      (daysUntilDue != null && daysUntilDue < 0)) {
    return { status: 'overdue', dueByOdometer, dueByDate, daysUntilDue, milesUntilDue };
  }

  // Due soon if within 500 miles or 14 days
  if ((milesUntilDue != null && milesUntilDue <= 500) ||
      (daysUntilDue != null && daysUntilDue <= 14)) {
    return { status: 'due_soon', dueByOdometer, dueByDate, daysUntilDue, milesUntilDue };
  }

  return { status: 'upcoming', dueByOdometer, dueByDate, daysUntilDue, milesUntilDue };
}
```

### 6.6 Privacy Architecture

- **Zero network requests:** The app makes no HTTP calls. No analytics, no crash reporting, no GPS, no telemetry.
- **No location permissions:** MyCar never requests GPS/location access. Station names are free text input.
- **No VIN lookups:** VIN is stored locally for the user's reference. It is never sent to a lookup service.
- **Local SQLite only:** All data in the app's sandboxed document directory.
- **No accounts:** No registration, no login, no cloud sync.
- **Photo storage:** Receipt and document photos stored in the app sandbox. Never uploaded.
- **Export is explicit:** PDF and CSV export triggered only by user action. Shared via system share sheet.
- **No background activity:** No background refresh, no location tracking, no push server.

---

## 7. UI/UX Direction

### 7.1 Design Language

- **Theme:** Dark mode default, automotive-inspired warmth
- **Typography:** Inter (humanist sans-serif), 16pt base
- **Colors:**
  - Background: `#0F0F0F` (near-black)
  - Surface: `#1A1A1A` (card backgrounds)
  - Surface elevated: `#242424` (modals, sheets)
  - Primary: `#F59E0B` (amber-500, warm automotive gold)
  - Accent fuel: `#14B8A6` (teal-500, for fuel/economy stats)
  - Accent warn: `#F97316` (orange-500, for "due soon" reminders)
  - Error/overdue: `#EF4444` (red-500)
  - Success: `#22C55E` (green-500, for "all good" states)
  - Text primary: `#F5F5F5`
  - Text secondary: `#A3A3A3`
- **Vehicle cards:** Rounded rectangles with a subtle gradient top edge matching vehicle color
- **Iconography:** Lucide icons
- **Animations:** Subtle — odometer counter roll animation, reminder status color transitions

### 7.2 Screen Flow

```
App Launch → Garage (default tab)
├── Garage Tab
│   ├── Vehicle Carousel (horizontal scroll of vehicle cards)
│   │   ├── Each card shows: photo, nickname, year/make/model, odometer, next service due
│   │   └── [+ Add Vehicle] → Add Vehicle Form
│   ├── [Tap Vehicle] → Vehicle Detail
│   │   ├── Header: photo, name, odometer
│   │   ├── Quick Stats: total spent, last service, MPG trend
│   │   ├── Tabs: Service Log | Fuel Log | Documents
│   │   │   ├── Service Log: chronological list of maintenance entries
│   │   │   │   ├── [Tap Entry] → Entry Detail (with photos, edit, delete)
│   │   │   │   └── [+ Add Service] → Add Service Entry
│   │   │   │       ├── Service Type Picker (pre-defined + custom)
│   │   │   │       ├── Date, Odometer, Cost
│   │   │   │       ├── Location, Notes (free text)
│   │   │   │       ├── [Attach Photo] → Camera/Gallery picker
│   │   │   │       └── [Save]
│   │   │   ├── Fuel Log: chronological list of fill-ups
│   │   │   │   ├── Each shows: date, gallons, cost, MPG
│   │   │   │   └── [+ Add Fill-Up] → Add Fuel Entry
│   │   │   │       ├── Date, Odometer, Quantity, Price per unit
│   │   │   │       ├── Full Tank toggle
│   │   │   │       ├── Station name, Octane grade
│   │   │   │       └── [Save]
│   │   │   └── Documents: grid of stored photos
│   │   │       ├── [Tap] → Full-screen viewer
│   │   │       └── [+ Add Document] → Camera/Gallery + type/expiry
│   │   └── [Export PDF] → Generate & share service history
│   └── Dashboard Summary
│       ├── Next 5 reminders across all vehicles
│       └── Monthly spend summary
├── Reminders Tab
│   ├── Grouped by vehicle
│   ├── Color-coded: green (upcoming), amber (due soon), red (overdue)
│   ├── [Tap Reminder] → Reminder Detail (edit interval, snooze, dismiss)
│   └── [+ Add Reminder] → Create Reminder
│       ├── Select Vehicle
│       ├── Service Type
│       ├── Mileage Interval and/or Date Interval
│       └── [Save]
├── Expenses Tab
│   ├── Monthly breakdown (bar chart)
│   ├── Category breakdown (pie chart)
│   ├── Per-vehicle summary cards
│   ├── Expense list (filterable by vehicle, category, date range)
│   └── [Export CSV] → Generate & share
└── Settings Tab
    ├── Units (US / Metric)
    ├── Currency
    ├── Appearance (Dark / Light / System)
    ├── Notifications (reminder alerts, timing)
    ├── Data (Backup, Restore, Clear)
    └── About
```

### 7.3 Key Interaction Patterns

**Quick Add:** Floating action button on the Garage tab — tap to log a service or fill-up in 3 taps. Most common action should be fastest.

**Odometer Auto-Increment:** When adding a new entry, odometer field pre-fills with the last known reading. User adjusts up. Prevents data entry errors.

**Smart Defaults:** When logging an oil change, the cost field suggests the average of previous oil change costs. Service type picker shows most-used types first.

**Receipt Snap:** Camera opens directly from the "Add Service" form. Photo is cropped to receipt aspect ratio. No OCR in MVP — just photo storage for proof.

**PDF Export:** One tap generates a clean, professional service history. No branding, no watermarks. The PDF looks like it came from a dealership, not an app. Includes vehicle info header, chronological table, total investment summary.

---

## 8. Monetization

### 8.1 Pricing Model

- **$4.99 one-time purchase** via App Store (iOS/Android) and Mac App Store
- **Direct purchase option** via Lemon Squeezy
- **No free tier limitations.** The full app is the paid app.
- **No subscriptions.** The logbook metaphor reinforces this — you don't pay monthly for a notebook.

### 8.2 Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Downloads | 300 | 2,000/mo | 4,000/mo |
| Revenue (gross) | $1,497 | $9,980/mo | $19,960/mo |
| Revenue (net, after Apple 15%) | $1,272 | $8,483/mo | $16,966/mo |

### 8.3 Cost Structure

- **Hosting:** $0 (no backend)
- **App Store fees:** Apple 15%, Google 15%
- **Development:** Time investment only
- **Marketing:** Organic Reddit/community posts + targeted car forum partnerships

---

## 9. Marketing Angle

### 9.1 Core Messaging

**Tagline:** "Your car's logbook. Private, offline, forever."

**Positioning statements:**
- "Your driving data isn't for sale. No GPS tracking, no insurance company data sharing."
- "Log maintenance, track fuel, export service history. $4.99 once."
- "Multi-vehicle household? One app, all your cars."
- "Generate a professional maintenance record when it's time to sell."

### 9.2 Launch Channels

| Channel | Strategy | Expected Impact |
|---------|----------|-----------------|
| **r/cars** (6.4M) | "I built a private car maintenance tracker" — privacy angle | High — massive audience, privacy-aware |
| **r/MechanicAdvice** (1.3M) | "App for tracking service history without data harvesting" | High — practical audience |
| **r/Cartalk** (800K) | Comparison post: "Why I stopped using Drivvo/FIXD" | Medium — engaged community |
| **r/Frugal** (2.5M) | "Track your car expenses, $4.99 once, no subscriptions" | Medium — price-sensitive audience |
| **r/AutoDetailing** (660K) | Detail log + maintenance tracking angle | Medium — meticulous users |
| **Car-specific subreddits** | Targeted posts in r/Honda, r/Toyota, r/BMW, etc. | Medium — enthusiast communities |
| **Product Hunt** | "Your car's private logbook" launch | Medium — tech early adopters |
| **YouTube mechanic channels** | Partner with ChrisFix, Scotty Kilmer fans for reviews | High — video content converts well |

### 9.3 Content Strategy

- **Blog posts:** "What Your Car App Knows About You", "How to Document Maintenance for Resale", "DIY Maintenance Schedule for [Toyota Camry / Honda Civic / etc.]"
- **Comparison pages:** MyCar vs Drivvo, MyCar vs Simply Auto, MyCar vs FIXD
- **ASO keywords:** "car maintenance tracker offline", "vehicle log private", "fuel tracker no account"

### 9.4 Resale PDF as Viral Loop

The service history PDF is designed to be shared. When a car buyer receives a MyCar-generated PDF, they see a clean document with a subtle "Generated by MyCar" footer. This creates organic word-of-mouth:
- Seller uses MyCar to generate service history
- Buyer sees professional PDF, asks "what app is that?"
- Buyer downloads MyCar for their own vehicles

---

## 10. MVP Timeline

### Week 1-2: Foundation
- [ ] Initialize Turborepo monorepo with Expo + Next.js + shared packages
- [ ] Set up SQLite database layer with schema and migrations
- [ ] Vehicle CRUD (create, read, update, delete, photo)
- [ ] Tab navigation scaffold (Garage, Reminders, Expenses, Settings)
- [ ] Vehicle card component with summary stats
- [ ] Dark mode theme tokens

### Week 3-4: Maintenance & Fuel Logging
- [ ] Service log CRUD with pre-defined service types
- [ ] Custom service type support
- [ ] Photo attachment for service entries (camera + gallery picker)
- [ ] Fuel fill-up CRUD
- [ ] MPG/L100km calculation engine
- [ ] Odometer auto-increment on new entries
- [ ] Vehicle detail screen with Service Log and Fuel Log tabs

### Week 5-6: Reminders & Notifications
- [ ] Reminder creation with mileage and/or date intervals
- [ ] Reminder evaluation engine (upcoming / due soon / overdue)
- [ ] Local push notifications for due reminders
- [ ] Reminders dashboard grouped by vehicle
- [ ] Snooze and dismiss functionality
- [ ] Auto-link reminders to service log entries (when oil change is logged, oil reminder resets)
- [ ] Document storage with expiry tracking

### Week 7-8: Expenses & Export
- [ ] Other expense logging (insurance, parking, tolls, etc.)
- [ ] Monthly and yearly expense summaries
- [ ] Cost breakdown charts (bar chart by month, pie by category)
- [ ] Per-vehicle total cost of ownership
- [ ] PDF service history generation
- [ ] CSV expense export
- [ ] Share sheet integration

### Week 9-10: Polish & Launch
- [ ] Settings screen (units, currency, appearance, data management)
- [ ] Backup and restore functionality (export/import JSON)
- [ ] Cross-platform testing (iOS, Android, web)
- [ ] Fuel economy trend chart
- [ ] Next.js web app (vehicle management + log entry)
- [ ] App icon, splash screen, App Store screenshots
- [ ] App Store metadata and privacy policy

### Week 11-12: Launch
- [ ] RevenueCat integration (one-time purchase)
- [ ] Lemon Squeezy storefront for direct sales
- [ ] Beta testing with 10-15 car enthusiasts from Reddit
- [ ] App Store submission
- [ ] Launch posts: Reddit (r/cars, r/MechanicAdvice), Product Hunt
- [ ] Comparison blog posts published

---

## 11. Acceptance Criteria

The MVP is complete when all of the following are true:

### Functional
- [ ] User can add multiple vehicles with photo, year/make/model, VIN, odometer
- [ ] User can log maintenance services with date, odometer, cost, photos, notes
- [ ] User can log fuel fill-ups with quantity, cost, and full-tank flag
- [ ] App correctly calculates MPG or L/100km between consecutive full fills
- [ ] Maintenance reminders fire based on mileage interval and/or date interval
- [ ] Local push notifications alert when reminders are due
- [ ] User can store vehicle documents (insurance, registration) with expiry dates
- [ ] Expense tracker aggregates all costs with monthly/category breakdowns
- [ ] PDF export generates a clean, professional service history document
- [ ] CSV export produces a valid spreadsheet of all expenses
- [ ] Settings allow unit, currency, and appearance customization
- [ ] Backup/restore works (export JSON, import JSON, data preserved)
- [ ] App works fully offline on iOS, Android, and web

### Non-Functional
- [ ] Cold launch to garage view < 1 second
- [ ] Handles 10+ vehicles and 1,000+ log entries without lag
- [ ] App size < 20MB (before user photos)
- [ ] Zero network requests (verified via network inspector)
- [ ] No location permission requests
- [ ] All data stored in app sandbox / document directory
- [ ] Photos compressed to reasonable size (< 2MB each) on save

### Business
- [ ] App Store listing live on iOS and Android
- [ ] One-time purchase flow works via RevenueCat
- [ ] Direct purchase flow works via Lemon Squeezy
- [ ] Privacy policy published (emphasizes no GPS, no data sharing)
- [ ] Launch posts prepared for r/cars, r/MechanicAdvice, Product Hunt

---

## 12. Future Roadmap (Post-MVP)

These are explicitly **not** in the MVP:

1. **OBD-II integration** — Optional Bluetooth OBD reader support for automatic odometer and diagnostic code reading. On-device only, no data sharing.
2. **Receipt OCR** — Scan a receipt photo and auto-fill date, cost, and service type. On-device ML model (Apple Vision framework), no cloud OCR.
3. **Recall alerts** — Periodic check against NHTSA recall database for the user's year/make/model (the only network request, user-initiated).
4. **Apple Watch complication** — Show next service due and current odometer.
5. **Widgets** — Home screen widget showing next maintenance due per vehicle.
6. **iCloud backup** — Optional iCloud Drive backup for users who want cross-device sync. User-initiated, not automatic.
7. **Vehicle valuation** — Rough KBB/Edmunds-style value estimate based on year/make/model/mileage. Single API call, user-initiated.
8. **Family sharing** — Share vehicle access with household members via QR code (local network transfer, no server).
