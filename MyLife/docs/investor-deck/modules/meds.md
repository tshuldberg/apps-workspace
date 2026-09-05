# MyMeds — Module Audit

**ID:** meds | **Prefix:** md_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.6.0
**One-line promise:** Your private health command center

## User Value
- Medication tracking with doses, reminders, refills, burn rate, and supply alerts
- Drug interaction checker with 200+ pair database and severity levels
- BP + glucose + insulin + A1c logging with classification engines and med-marker correlation
- Mood + symptom journaling with activity correlation and wellness timeline
- Doctor + therapy report generator (markdown export) with wellness score (0-100)

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Medication CRUD + active/inactive + pill count | src/db/crud.ts, medication-extended | shipped |
| Reminder scheduling + snooze + dismiss | src/reminders/scheduler.ts | shipped |
| Dose logging + undo | src/db/crud.ts | shipped |
| Refill tracking (burn rate, days remaining) | src/medication/refill-tracker.ts | shipped |
| Adherence rate + streak + calendar | src/reminders/adherence.ts | shipped |
| Drug interactions (200+ pairs) | src/interactions/checker.ts, database.ts | shipped |
| BP logging + AHA classification + trends | src/bp/engine.ts, trends.ts | shipped |
| Glucose + time-in-range + A1c estimate (GMI) | src/glucose/engine.ts, a1c.ts | shipped |
| Insulin (IOB, injection site rotation) | src/insulin/engine.ts | shipped |
| Caregiver alerts + weekly summary | src/caregiver/engine.ts | shipped |
| FODMAP tracking + trigger correlation | src/fodmap/engine.ts | shipped |
| Weather-symptom correlation | src/weather/engine.ts | shipped |
| Pain location heatmap + severity by zone | src/pain/engine.ts | shipped |
| CGM integration (trend arrows, TIR, AGP) | src/cgm/engine.ts | shipped |
| Mood + symptom journaling | src/mood, src/diary | shipped |
| Mood-med, symptom-med, adherence-mood correlation | src/analytics/correlation.ts | shipped |
| Medication insights (pattern detection) | src/engine/medication-insights.ts | shipped |
| Regimen summary (daily briefing) | src/engine/regimen-summary.ts | shipped |
| Wellness score (0-100 composite) | src/engine/wellness-score.ts | shipped |
| Doctor + therapy report (markdown) | src/export/markdown-report.ts | shipped |
| Healthcare contacts + appointments (V5) | schema V5 | shipped |
| Medication diary entries (V6) | schema V6 | shipped |

## Data Model
Prefix `md_`, schema v6. Tables: md_medications, md_doses, md_dose_logs, md_reminders, md_refills, md_symptoms, md_symptom_logs, md_mood_entries, md_activities, md_mood_activities, md_measurements, md_interactions, md_settings, plus V3 (bp_readings, glucose_readings, insulin_entries, injection_sites), V4 (caregivers, caregiver_alert_config, caregiver_alerts, a1c_records, fodmap_foods, food_diary, stool_logs, weather_snapshots, weather_symptom_links, pain_entries, cgm_readings, cgm_sync_state), V5 (contacts, appointments), V6 (diary_entries).

## Screens / User Flows
Mobile tabs: Today, Medications, Vitals, Insights, More. Stack screens: med-detail/add-med/schedule, mood-check-in, measurement-log, correlation, export, interactions, refills, diary, log-bp/bp-history/bp-trends, log-glucose/glucose-history/a1c, log-insulin/insulin-history, caregivers, fodmap, weather, pain-map, cgm. 34 mobile route files, 22 web route files.

## Distinctive / Moat-worthy
- Also re-exported via @mylife/health — single underlying schema powers both the dedicated Meds module and the Health hub
- Pain heatmap + weather-symptom correlation + CGM analytics are Dexcom/Clarity-adjacent features in a consumer app
- Wellness score (0-100) fuses adherence, vitals, mood, symptoms into one number patients can share

## Gaps vs competitors
- No live drug database (RxNorm integration is scoped, not shipped — see CLAUDE.md roadmap)
- No cloud caregiver delivery (alerts generate locally; no verified push/SMS channel)
- Medisafe gaps: calendar sync + onboarding flow + notifications polish still deferred

## Investor-facing hook
A single free-to-install app fuses Medisafe + MySugr + Dexcom Clarity + Qardio + Omron Connect + Migraine Buddy under one privacy-first roof, then hands the user a doctor-grade markdown report.
