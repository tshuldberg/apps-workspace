# MySleep Module Audit

**ID:** sleep | **Prefix:** sl_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Track your sleep, remember your dreams

## User Value
- Manual nightly sleep journal with wake-feeling scoring
- Dream capture with pattern analysis
- Factor tracking (caffeine, stress, screens) correlated to quality
- Nap logs and sleep streak tracking
- Explicit, opt-in bridges into Mood, Habits, and Health modules

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Core schema (entries, naps, dreams, factors, goals, streaks, settings) | src/db/schema.ts | shipped |
| Sleep log tab | app/(sleep)/log.tsx | shipped |
| Sleep entry wizard | app/(sleep)/SleepEntryWizard.tsx | shipped |
| Dreams tab | app/(sleep)/dreams.tsx | shipped |
| Insights tab | app/(sleep)/insights.tsx | shipped |
| Entry detail screen | app/(sleep)/entry | shipped |
| Settings | app/(sleep)/settings.tsx | shipped |
| Wake-feeling Zod enum | src/types.ts | shipped |
| Bridge settings (Mood/Habits/Health) | SleepBridgeSettingsSchema | shipped |

## Data Model
Prefix `sl_`, schema v2. Tables: sl_sleep_entries, sl_naps, sl_dreams, sl_factors, sl_goals, sl_streaks, sl_settings. Explicitly separate from MyHealth's `hl_` sensor-based sleep surfaces.

## Screens / User Flows
Mobile tabs: Sleep, Dreams, Insights, Settings. Secondary: entry detail, dream detail, dream patterns, goals. Web: parity folder at apps/web/app/sleep.

## Distinctive / Moat-worthy
- Separation of "sensor sleep" (Health) vs "journal sleep" (Sleep), two different mental models
- Dream journaling + pattern detection (not in Apple Sleep, Oura, or Whoop)
- Guardrail: cannot reuse `hl_` tables; cross-module bridges are explicit and opt-in

## Gaps vs competitors
- No HealthKit autosync (competitors: Apple Sleep, Oura, AutoSleep, Whoop)
- No smart-alarm wake window (Health module owns that surface)
- Release-state is hidden until UIUX mission control ships

## Investor-facing hook
The private dream journal and sleep-factor ledger that complements wearable data, not competes with it.
