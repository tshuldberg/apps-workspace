# MyFast — Module Audit

**ID:** fast | **Prefix:** ft_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 1.0.0 (schema v4)
**One-line promise:** Fasting and hydration, completely private

## User Value
- 8 preset fasting protocols plus custom, with 6 physiological zones shown in real time.
- Timer state machine survives app kill, reboots, and phone swaps.
- Multi-beverage hydration (12 types with hydration coefficients) and caffeine tracking with half-life curves.
- Smart reminders with personalized targets, not spam.
- Free tier: earn trust before asking for premium.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Fasting timer + zone engine | modules/fast/src/timer.ts, zones.ts, protocols.ts | shipped |
| Active fast + history + streaks | modules/fast/src/db/fasts.ts (ft_active_fast, ft_fasts, ft_streak_cache) | shipped |
| Weight tracking + trends | modules/fast/src/db/weight.ts (ft_weight_entries) | shipped |
| Multi-beverage hydration | modules/fast/src/engines/hydration.ts, db/beverages.ts, water.ts | shipped |
| Caffeine half-life curves | modules/fast/src/engines/caffeine-engine.ts | shipped |
| Container presets | modules/fast/src/db/containers.ts (ft_container_presets) | shipped |
| Smart water reminders | modules/fast/src/engines/water-reminder-engine.ts | shipped |
| Goals + progress | modules/fast/src/db/goals.ts (ft_goals, ft_goal_progress) | shipped |
| Fast quality score | modules/fast/src/engines/quality-score.ts | shipped |
| Protocol progression suggestions | modules/fast/src/engines/protocol-progression.ts | shipped |
| Week-in-review | modules/fast/src/engines/week-in-review.ts | shipped |
| HealthKit sync engine | modules/fast/src/engines/healthkit-sync.ts | shipped (engine only) |
| Apple Watch sync engine | modules/fast/src/engines/watch-sync.ts | shipped (engine only) |
| CSV export | modules/fast/src/export.ts | shipped |
| Notifications config | modules/fast/src/db/notifications.ts | shipped |
| Stats aggregator | modules/fast/src/stats/ | shipped |

## Data Model
- ft_active_fast, ft_fasts, ft_streak_cache, ft_protocols, ft_goals, ft_goal_progress, ft_weight_entries, ft_beverage_types, ft_beverage_log, ft_water_intake, ft_container_presets, ft_notifications_config, ft_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(fast)/ -- index, history, stats, caffeine, weight, settings.
- Web: apps/web/app/fast/ -- page, history/, stats/, settings/, actions.ts.

## Distinctive / Moat-worthy
- Composite 0-100 fast quality score (adherence + hydration + protocol fit) that Zero/Simple do not compute.
- Caffeine half-life modeling inside a fasting tracker, not a separate app.
- Protocol progression engine that suggests the next protocol based on sustained adherence.
- Offered free: the customer-acquisition funnel into premium modules.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- [ ] Apple Watch quick-log (P1) -- engine built; needs watchOS companion binary.
- [ ] HealthKit native integration (P1) -- engine built; needs native wiring.

## Investor-facing hook
MyFast is the free front door to the suite: it beats Zero on features, runs forever without a paywall, and hands the user a suite subscription prompt exactly when they care about weight plus hydration plus sleep.
