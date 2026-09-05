# MyCar — Module Audit

**ID:** car | **Prefix:** cr_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0 (schema v11)
**One-line promise:** Your complete vehicle companion

## User Value
- One place for every vehicle: service, fuel, insurance, registration, tires, parking, trips.
- OBD-II diagnostics, live data logs, and a DTC database without a FIXD subscription.
- Automatic fuel economy, cost-per-mile, and maintenance cost analytics.
- Trip log with GPS, parking saver, and fuel price comparison.
- Document vault for insurance and registration on device.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Multi-vehicle + service history | modules/car/src/db/crud.ts, schema.ts (cr_vehicles, cr_maintenance) | shipped |
| Maintenance schedules + reminders | modules/car/src/engines/reminder-engine.ts, db/ (cr_maintenance_schedules) | shipped |
| Fuel logs + economy + cost | modules/car/src/engines/cost-engine.ts, db (cr_fuel_logs) | shipped |
| Fuel price comparison | modules/car/src/engines/fuel-price-engine.ts | shipped |
| Trip log + GPS | modules/car/src/engines/trip-engine.ts, gps-engine.ts, db/trips.ts, gps-trips.ts | shipped |
| Parking saver | modules/car/src/engines/parking-engine.ts, db/parking.ts | shipped |
| Insurance docs | modules/car/src/engines/insurance-engine.ts, db/insurance.ts | shipped |
| Registration/inspection | modules/car/src/engines/registration-engine.ts, db/registrations.ts | shipped |
| Tire sets + rotations + measurements | modules/car/src/engines/tire-engine.ts, db/tires.ts | shipped |
| OBD-II + DTC database | modules/car/src/engines/obd-engine.ts, dtc-database.ts, db/diagnostics.ts | shipped |
| VIN decoder | modules/car/src/engines/vin-engine.ts | shipped |
| Recall alerts | modules/car/src/db/ (cr_recalls) | shipped |

## Data Model
- cr_vehicles, cr_maintenance, cr_maintenance_schedules, cr_fuel_logs, cr_trips, cr_gps_trips, cr_parking_locations, cr_insurance_policies, cr_insurance_documents, cr_registrations, cr_registration_documents, cr_tire_sets, cr_tire_rotations, cr_tire_measurements, cr_diagnostic_codes, cr_diagnostic_snapshots, cr_live_data_logs, cr_recalls, cr_settings.
- Notable: v11 adds a composite index on live_data_logs(vehicle_id, logged_at) for OBD query perf.

## Screens / User Flows
- Mobile: apps/mobile/app/(car)/ -- index, garage, maintenance, service-history, service/, reminders, fuel, fuel/, fuel-prices, cost-analytics, documents, document/, expenses, diagnostics, diagnostics/, obd, live-data, tires, parking, parking-history, gps-dashboard, settings.
- Web: apps/web/app/car/ -- page, vehicles/, service/, fuel/, expenses/, trips/, reminders/, documents/, garage/, settings/, actions.ts, ui.ts.

## Distinctive / Moat-worthy
- OBD-II + DTC lookup inside a tracking app (FIXD charges $9.99/mo for less).
- Full document vault for insurance and registration on-device.
- Fuel price engine + cost-per-mile integrated with the trip log, not a separate GasBuddy login.
- Local recall tracking without selling your VIN to a data broker.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- None -- section 19 marks all features shipped.

## Investor-facing hook
MyCar consolidates CARFAX, Simply Auto, FIXD, and GasBuddy into one local-first car record that the user actually owns.
