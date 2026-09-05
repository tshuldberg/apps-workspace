# MyFast - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete (14+ tables, 8 engine files, 100% competitive parity)
**CEO Review:** GP-17-6a (2026-03-24) -- SCOPE EXPANSION mode. Identity rewrite, eating window state, protocol progression, quality score, week-in-review engine, 72h + 5:2 protocols.

## Current State

MyFast is the free-tier module in MyLife, providing intermittent fasting and hydration tracking. Current features include a fasting timer with 8 presets (16:8, 18:6, 20:4, 5:2, OMAD, etc.), 5 fasting zones (Anabolic, Catabolic, Fat Burning, Ketosis, Deep Ketosis), streak tracking, weight tracking, water intake logging, home screen widgets, and CSV export. All data is stored locally in SQLite with the `ft_` table prefix.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| Zero | $70/yr | Fasting | Fasting-focused, research-backed zones, community |
| Noom | $209/yr | Weight loss | Behavioral psychology, coaching, calorie tracking |
| MyFitnessPal | $80-100/yr | Calorie tracking | Massive food database (14M+ items), barcode scanning |
| Lose It! | $40/yr | Calorie tracking | AI photo food logging, calorie budgets |
| Yazio | $33/yr | Nutrition | Fasting timer + calorie tracking combo |
| Cronometer | $60/yr | Micronutrient tracking | Detailed vitamin/mineral tracking, research-grade accuracy |
| WaterMinder | $10/yr | Hydration | Hydration-focused, Apple Watch, smart reminders |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Smart water reminders | P1 | WaterMinder | Low | Personalized daily water goal based on body weight. Scheduled reminders with adjustments for activity level and weather. Push notifications at configurable intervals. |
| Multi-beverage types | P1 | WaterMinder | Low | Track different drink types (water, tea, coffee, juice, smoothie, etc.) with hydration coefficients (coffee counts as 0.8x water, etc.). |
| Apple Watch quick-log | P1 | WaterMinder, Zero | Medium | Log water intake and start/stop fasts from a watch complication. Requires watchOS companion app. |
| Wearable sync (HealthKit) | P1 | Noom, MFP, Lose It!, Yazio, Cronometer, WaterMinder | Medium | Sync with HealthKit for heart rate, steps, calories burned, and weight. Enrich fasting data with activity context. |
| Caffeine tracking | P2 | WaterMinder | Low | Track coffee, tea, and energy drink consumption. Show daily caffeine total (mg) and estimated metabolization timeline. |
| Custom container presets | P2 | WaterMinder | Low | Save favorite cup/bottle sizes for one-tap water logging. "My Nalgene (32oz)", "Office mug (12oz)", etc. |
| Community/social | P3 | Zero, Noom, MFP | High | Social features like fasting groups and leaderboards. Deprioritized because privacy-first positioning makes this a tricky fit. Could offer opt-in anonymized streaks. |

**Note on scope:** Calorie tracking, macro tracking, food database search, AI photo food logging, barcode scanning, and meal planning are explicitly out of scope for MyFast. These features represent a fundamentally different use case (nutrition tracking) and are recommended as a separate **MyNutrition** module. MyFast should remain focused on fasting windows and hydration.

## Recommended Features to Build

1. **Smart water reminders** - Calculate a personalized daily water goal based on body weight (stored in weight tracking). Send push notifications at configurable intervals (every 30/60/90/120 minutes) during waking hours. Show progress toward daily goal on the main timer screen. Pause reminders during fasting windows if the user prefers dry fasting.

2. **Multi-beverage types** - Extend the water intake system to support multiple beverage types. Each type has a name, icon, default serving size, and hydration coefficient. Water = 1.0x, herbal tea = 1.0x, coffee = 0.8x, juice = 0.9x, alcohol = -0.5x (net dehydrating). Total hydration = sum of (volume * coefficient). Add a beverage picker to the quick-log UI.

3. **Apple Watch quick-log** - Build a watchOS companion with two complications: (1) water intake quick-add (tap to log default amount), (2) fasting timer status (show current zone, tap to start/stop). Uses WatchConnectivity to sync with the phone app.

4. **HealthKit integration** - Read heart rate, step count, active calories, and weight from HealthKit. Write fasting sessions as metadata. Show activity data alongside fasting data: "You burned 2,400 calories during your 18-hour fast." Use HealthKit weight data to auto-update weight tracking.

5. **Caffeine tracking** - Log caffeine intake by beverage type (espresso = 63mg, drip coffee = 95mg, green tea = 28mg, etc.). Show daily total and a metabolization curve (caffeine half-life of ~5 hours). Warn if caffeine intake is late in the day relative to typical sleep time. Store caffeine data in the `ft_` prefixed tables.

6. **Custom container presets** - Let users save named container presets with custom volumes. Show presets as quick-tap buttons on the hydration logging screen. Seed with common defaults (8oz glass, 12oz can, 16oz bottle, 32oz Nalgene, 40oz Stanley).

## Privacy Competitive Advantage

Zero charges $70/year and requires a cloud account that stores all fasting history on their servers. Your fasting patterns reveal health conditions, religious practices, and body image concerns, all deeply personal data.

Noom at $209/year is one of the most expensive health apps and has faced criticism for its aggressive data collection and retention practices. MFP suffered a data breach in 2018 exposing 150 million accounts.

MyFast is the free tier of MyLife and works entirely offline. No account required. No cloud storage. Your fasting patterns, weight data, and hydration habits stay on your device. This makes MyFast the only free, privacy-first fasting timer with feature parity against $70/year competitors.

Marketing angle: "The best fasting app is free. And it doesn't sell your health data."

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyNutrition** | If built as a separate module: share eating window data so MyNutrition knows when to expect meals. Show calorie intake during eating windows on the fasting timeline. |
| **MyHealth** | Fasting impact on vitals (heart rate variability, resting heart rate trends during extended fasts). HealthKit data shared between modules. |
| **MyRecipes** | Meal planning around fasting windows. "Your eating window opens at 12pm. Here are lunch recipes ready in under 30 minutes." |
| **MyWorkouts** | Workout timing relative to fasting state. "You worked out in the Fat Burning zone today." Show fasting zone context on workout entries. |
| **MyMood** | Correlate fasting with mood entries. "Your mood tends to dip on day 2 of extended fasts." |
| **MyHabits** | Fasting streak as a trackable daily habit. Water intake goal as a daily habit. |
