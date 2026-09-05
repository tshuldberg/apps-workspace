# MyWorkouts Module Audit

**ID:** workouts | **Prefix:** wk_ | **Tier:** premium | **Storage:** sqlite (local-first; note: CLAUDE.md confirms on-device storage despite upstream task hint of Supabase)
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.5.0
**One-line promise:** Your gym data, your device, your gains

## User Value
- 50+ exercise library with body-map targeting
- Workout builder with supersets and speed control
- Session state machine (idle / playing / paused / rest / completed)
- 1RM calculator (Epley + Brzycki), warmup sets, plate loader
- Progressive overload automation with configurable triggers
- Muscle recovery heatmap (14 muscle groups)
- AI workout generator (rule-based, local)
- GPS recording for cardio with pace, elevation, calories
- Apple Watch sync protocol
- Progress photos with comparisons
- Voice commands (20 phrases)
- Opt-in social feed with privacy filters
- Cross-module intelligence: mood-lift, fasting performance, protein recovery, time-of-day, volume-mood

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Exercise library CRUD + seed | src/db/crud.ts + exercise-seed.json | shipped |
| Workout + session CRUD | src/db/crud.ts | shipped |
| Form recordings | src/db/crud.ts | shipped |
| Dashboard + metrics | src/db/crud.ts | shipped |
| Set weight + 1RM history | V3 schema | shipped |
| Body measurements | V3 schema | shipped |
| Workout plans + subscriptions | V3 schema | shipped |
| Overload rules + suggestions | src/overload/engine.ts, V4 | shipped |
| AI generation history | src/ai/generator.ts, V4 | shipped |
| GPS routes + points | src/gps/metrics.ts, V4 | shipped |
| Plate inventories + progress photos | V5 | shipped |
| Trainer profiles + exercise demo videos | V6 | shipped |
| Workout player state machine | src/workout/engine.ts | shipped |
| 1RM Epley + Brzycki | src/workout/oneRM.ts | shipped |
| Warmup + plates | src/workout/warmup.ts, plates.ts | shipped |
| Body map (14 groups) | src/body-map.ts | shipped |
| Voice parser (20 phrases) | src/voice.ts | shipped |
| Progress analytics (streaks, PRs, volume) | src/progress.ts | shipped |
| Recovery heatmap | src/recovery/engine.ts | shipped |
| Watch sync protocol | src/watch/sync-protocol.ts | shipped |
| Sharing summary cards | src/sharing.ts | shipped |
| Social privacy filters | src/social/privacy.ts | shipped |
| Demo asset resolver | src/demo.ts | shipped |
| 6 cross-module insight detectors | src/intelligence/insight.ts | shipped |
| 17 mobile screens | app/(workouts)/* | shipped |

## Data Model
Prefix `wk_`, schema v6, 18+ tables, 6 migrations. Storage is SQLite (local-first) per module definition despite cross-module cloud potential. Data bridge reads mo_, nu_, ft_ tables for cross-module correlations with existence guards.

## Screens / User Flows
Mobile tabs: Home, Explore, Workouts, Progress, Profile. 17 screens including builder, generate, gps, recovery, overload settings, plate calc, photos, photo compare, share card, exercise demo, social, social profile, insights, onboarding, body-map, superset, timer, watch. Web route parity.

## Distinctive / Moat-worthy
- 464+ tests across 26 files, deepest test coverage in the suite
- 13 engine modules covering every flow from plate loading to recovery to AI generation
- Cross-module intelligence engine (6 detectors) is a genuine moat: no Fitbod, Strong, or Hevy competitor reads your mood, nutrition, and fasting data to correlate workout performance
- Opt-in social is privacy-first by construction (applyPrivacyFilter is explicit)
- Apple Watch sync protocol defined in pure functions (not a closed SDK dependency)

## Gaps vs competitors
- Exercise demo videos require trainer upload content (schema ready, assets TBD)
- Social feed is new, no network-effect moat yet
- Cloud sync across devices would require an opt-in Supabase tier (current: local-only)

## Investor-facing hook
Strong plus Hevy plus Fitbod with a cross-module intelligence engine that no workout app has, turning the hub into the only place where your lifting data, mood, fasting, and protein intake sit in the same room.
