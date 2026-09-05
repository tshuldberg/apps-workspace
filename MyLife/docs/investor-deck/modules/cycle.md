# MyCycle — Module Audit

**ID:** cycle | **Prefix:** cy_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v5)
**One-line promise:** Private period and fertility tracker

## User Value
- Post-Dobbs private period tracking on-device; no server account, no subpoena surface.
- Temperature (BBT) charting with coverline and shift detection, on par with Natural Cycles.
- Pregnancy mode with week-by-week tracking and 4 due-date methods.
- Partner sync with granular per-field privacy controls via share codes.
- Weighted predictions (6-cycle moving average, recency-weighted) plus readable insights.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Cycle logging + day-level symptom tracking | modules/cycle/src/db/schema.ts (cy_cycles, cy_cycle_days, cy_symptoms) | shipped |
| Phase tracking + current phase calc | modules/cycle/src/engine/prediction.ts | shipped |
| Weighted moving-average prediction | modules/cycle/src/engine/prediction.ts | shipped |
| Fertile window + late detection | modules/cycle/src/engine/prediction.ts | shipped |
| BBT with coverline + shift | modules/cycle/src/engine/temperature.ts, db (cy_temperatures) | shipped |
| Partner sync (share codes, granular privacy) | modules/cycle/src/engine/sharing.ts, db (cy_partner_links) | shipped |
| Pregnancy mode + appointments | modules/cycle/src/engine/pregnancy.ts, db (cy_pregnancy_config, cy_appointments) | shipped |
| Insights engine (trends, regularity, patterns) | modules/cycle/src/engine/insights.ts | shipped |
| Cycle regularity scoring | modules/cycle/src/engine/insights.ts | shipped |
| Cross-module phase signal | modules/cycle/src/ (cross-module) | shipped |

## Data Model
- cy_cycles, cy_cycle_days, cy_symptoms, cy_temperatures, cy_partner_links, cy_pregnancy_config, cy_appointments.
- v5 adds granular mood and temperature partner sharing preferences.

## Screens / User Flows
- Mobile: apps/mobile/app/(cycle)/ -- (tabs), log-day, temperature, pregnancy, pregnancy-log, sharing, community, compare, insights-detail, predictions-detail, symptom-analysis, cycle-analytics.
- Web: apps/web/app/cycle/ -- page, log/, calendar/, history/, predictions/, analytics/, bbt/, symptoms/, insights/, pregnancy/, sharing/, community/, settings/, actions.ts, ui.ts.

## Distinctive / Moat-worthy
- Fully local-first period tracker in the Dobbs era; no server account, no data-sharing risk.
- Partner sync via device-to-device share codes with per-field granularity (not an app login for the partner).
- BBT + pregnancy + cycle prediction in one module; competitors split these or lock premium.
- Privacy posture is itself a wedge in an industry accused of selling cycle data.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- [ ] Community forums (P2) -- handled by MyForums module; cross-module wiring still pending here.

## Investor-facing hook
MyCycle is the only period tracker whose business model cannot be subpoenaed, because the data never leaves the phone, and the suite subscription replaces the ad economy that powers Flo.
