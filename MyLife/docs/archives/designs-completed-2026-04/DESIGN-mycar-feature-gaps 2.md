# MyCar - Feature Status and Roadmap
**Source:** Competitive Feature Analysis (2026-03-05), CEO Review (2026-03-24)
**Status:** Feature-complete (100% competitive parity)

## Current State

MyCar is a complete vehicle ownership companion with 10 schema migrations, 12 domain engines, and 18 database tables. It covers every competitive feature identified across CARFAX Car Care, Simply Auto, FIXD, and Drivvo. All data is local SQLite with the `cr_` table prefix.

## Competitors Analyzed

| Competitor | Pricing | Platform | Cloud Required |
|-----------|---------|----------|---------------|
| Drivvo | Free with ads, Pro removes ads | iOS, Android | Optional sync |
| Fuelio | ~$5 one-time (Android), Free with ads (iOS) | iOS, Android | Optional sync |
| Expensify | Free tier / $5-18/mo business | iOS, Android, Web | Yes |
| CARFAX Car Care | Free | iOS, Android, Web | Yes |
| Simply Auto | Free/premium | iOS, Android | Optional sync |
| FIXD | $9.99/mo + $20 device | iOS, Android | Yes (requires device) |

## Phase 1: Core Features (Shipped, offline)

All features work fully offline with local SQLite.

| Feature | Migration | Engine | Status |
|---------|-----------|--------|--------|
| Multi-vehicle tracking | V1 | -- | Shipped |
| Service history logging | V1 | -- | Shipped |
| Fuel economy calculations | V1 | -- | Shipped |
| Maintenance cost analysis | V1 | cost-engine | Shipped |
| Maintenance schedule reminders | V2 | reminder-engine | Shipped |
| Trip log with purpose categories | V3 | trip-engine | Shipped |
| Insurance policy + document storage | V4 | insurance-engine | Shipped |
| Registration/inspection tracker | V5 | registration-engine | Shipped |
| Tire wear monitoring + rotation | V7 | tire-engine | Shipped |
| Parking location saver + meter timer | V8 | parking-engine | Shipped |
| Cost per mile/km analysis | -- | cost-engine | Shipped |
| Fuel price trend analysis | -- | fuel-price-engine | Shipped |

## Phase 2: Hardware/Network Features (Built, requires testing)

These features have full engine implementations and database schemas but depend on hardware or network access. They need real-device testing before being promoted to user-facing UI.

| Feature | Migration | Engine | Dependency | Status |
|---------|-----------|--------|------------|--------|
| GPS mileage tracking | V6 | gps-engine | Background location permissions | Built, needs device testing |
| VIN decoder + recall alerts | V9 | vin-engine | NHTSA API (network) | Built, needs network integration testing |
| OBD-II diagnostic reader | V10 | obd-engine, dtc-database | Bluetooth OBD-II adapter ($20+) | Built, needs hardware testing |
| Fuel price comparison | -- | fuel-price-engine | Location data (network) | Built, needs API source |

## Phase 3: Cross-Module Intelligence (Vision)

These features leverage MyCar's data alongside other MyLife modules to create value no standalone car app can match.

| Feature | Integrates With | Value |
|---------|----------------|-------|
| Auto-categorize vehicle expenses | MyBudget | Fuel fill-ups and maintenance costs flow into budget categories with trends |
| Car maintenance as habits | MyHabits | Recurring tasks (check tire pressure, wash car) with streak tracking |
| Commute impact tracking | MyHealth | Track commute duration and its effect on daily activity time |
| Maintenance prediction AI | packages/intelligence | Predict when maintenance is needed based on patterns, not just intervals |
| Cost optimization suggestions | packages/intelligence | "Switching to synthetic oil would save $120/yr based on your intervals" |
| Unified cost of ownership | MyBudget | True monthly cost: fuel + maintenance + insurance + depreciation |

## Privacy Competitive Advantage

Most car tracking apps are ad-supported (Drivvo free tier) or require cloud accounts for core functionality (Expensify). Fuelio is the closest privacy-respectable competitor as a one-time purchase, but it still uses optional cloud sync that many users enable by default. MyCar keeps all vehicle data, trip logs, documents, and location history strictly on-device. This is especially important for GPS tracking and OBD-II diagnostics, where driving patterns and engine health data are highly sensitive. Users get FIXD-level diagnostics and Expensify-level trip tracking without sharing their data with any server.

## Shared Pattern: Reminder Engine

MyCar's reminder-engine (interval-based scheduling by mileage OR time, snooze support, auto-link to completed maintenance) is a pattern that Homes (appliance maintenance), Pets (vet appointments), and Meds (refill reminders) all need. Future work: extract to shared `@mylife/scheduler` package.
