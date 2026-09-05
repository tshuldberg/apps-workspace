# MyHealth — Module Audit

**ID:** health | **Prefix:** hl_ | **Tier:** premium (fasting section free) | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Your health data, on your device, under your control

## User Value
- Unified health hub absorbing MyMeds, MyFast, and cycle tracking into a single dashboard
- Daily 0-100 health score fusing readiness, adherence, sleep, mood, activity, mindfulness
- Sleep stage analysis, sleep bank, smart alarm with wake window, snore detection
- Vitals + vault + emergency info + comprehensive doctor-visit report generator
- Cross-domain Pearson correlation engine between any two health time series

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Daily health score (6-domain composite) | src/health-score/engine.ts | shipped |
| Cross-domain correlation (Pearson) | src/correlation/engine.ts | shipped |
| Weekly digest with highlights/concerns | src/digest/engine.ts | shipped |
| Doctor visit report (markdown) | src/reports/doctor-report.ts | shipped |
| Readiness score (sleep + HRV + RHR + activity) | src/readiness/engine.ts | shipped |
| Breathing patterns (5) + session stats | src/breathing | shipped |
| Activity rings + streaks | src/activity/engine.ts | shipped |
| Sleep stage breakdown, bank, HR analysis | src/sleep | shipped |
| Smart alarm with wake window | src/smart-alarm | shipped |
| Snore detection + scoring | src/snore | shipped |
| HRV analysis + baseline + trend | src/hrv | shipped |
| Meditation sessions + streaks | src/meditation | shipped |
| CBT exercises | src/cbt | shipped |
| SOS crisis flow + grounding + hotlines | src/emergency, src/sos | shipped |
| Body measurements (BMI, lean mass) | src/body | shipped |
| SpO2 analysis + alerting | src/spo2 | shipped |
| Sleep aids (routines, ambient sounds) | src/sleep-aids | shipped |
| Wellness timeline (cross-module events) | src/timeline | shipped |
| Document vault + emergency info | src/documents | shipped |
| Cross-domain goals | src/goals | shipped |
| HealthKit adapter + sync engine | src/healthkit | shipped (needs native wiring) |
| Multi-app aggregation (CSV import dedup) | src/aggregation | shipped |
| Absorbed modules migration | src/migration/absorb.ts | shipped |

## Data Model
Prefix `hl_`, schema v3. 21 tables across V1 (documents, vitals, sleep_sessions, sync_log, goals, goal_progress, emergency_info, settings), V2 (breathing_sessions, readiness_scores, activity_summaries, cbt_entries, meditation_sessions, body_measurements, sos_sessions, sleep_routines, import_log), V3 (smart_alarms, alarm_history, snore_sessions, snore_events). Also reads/writes absorbed `md_*` (meds), `ft_*` (fast), `cy_*` (cycle) tables.

## Screens / User Flows
Mobile tabs: Today, Vitals, Activity, Sleep, Mind. Stack screens include fasting/fast-detail/choose-plan, med-detail/add-med/schedule/interactions, measurement-log/vital-detail/cycle-tracker/sleep-detail, mood-check-in/correlation/wellness-timeline/export, add-document/document-viewer/emergency-info/health-sync-settings, goal-detail/add-goal, cbt/breathing, migration-prompt. 32 mobile route files, 13 web route files.

## Distinctive / Moat-worthy
- Only consumer app fusing meds + fast + cycle + sleep + vitals + mind + HealthKit locally
- Doctor-report generator bundles meds, vitals, sleep, activity, mood, symptoms, emergency into one markdown export
- Cross-domain Pearson correlation is a user-facing feature, not a buried analytics tab

## Gaps vs competitors
- HealthKit adapter shipped but needs final native wiring
- No Apple Watch complication yet; no telehealth provider integrations
- V1 CRUD (documents, vitals, sleep, goals, emergency) lacks dedicated test coverage

## Investor-facing hook
A single local-first app replaces Apple Health, Medisafe, Oura, AutoSleep, SnoreLab, and Calm with a doctor-grade exportable record.
