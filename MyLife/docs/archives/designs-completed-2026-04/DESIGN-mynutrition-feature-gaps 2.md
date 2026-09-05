# MyNutrition - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Updated:** CEO Review (2026-03-25)
**Status:** Built (98% parity + intelligence engine beyond competitors)

## Rationale

MyNutrition is the #2 highest-impact module recommended for MyLife. MyFitnessPal suffered the largest health app data breach in history, exposing 150 million user accounts in 2018. MFP now charges $80-100/yr and shares location data for advertising purposes. Calorie and macro tracking is the most-requested nutrition feature across all health and fitness apps, making this a high-value addition to the MyLife suite. This module is intentionally separate from MyFast because food logging is fundamentally different from fasting timer management; they complement each other but serve distinct workflows.

## Competitors Analyzed

| Competitor | Pricing | Notable Issues |
|-----------|---------|----------------|
| MyFitnessPal | $80-100/yr | 150M account data breach (2018), shares location data for ads |
| Lose It! | $40/yr | Cloud-required, ad-supported free tier |
| Yazio | $33/yr | Cloud-required, limited free tier |
| Cronometer | $60/yr | Best privacy among competitors but still requires cloud account |
| Noom | $209/yr | Collects 50+ health questions, shares with third-party analytics |

## Recommended MVP Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Calorie logging (manual entry) | P0 | All competitors | Low | Enter food name, calories, serving size |
| Food database (USDA FoodData Central) | P0 | MFP (14M foods), Lose It! (32M), Cronometer (1.1M) | Medium | Start with USDA's 400K+ foods (free, public domain), expand over time |
| Barcode scanning | P0 | MFP, Lose It!, Yazio, Cronometer | Medium | Scan product barcodes to auto-fill nutrition data using Open Food Facts (open-source database) |
| Macronutrient tracking (protein, carbs, fat) | P0 | All competitors | Low | Track macros with daily targets |
| Daily calorie/macro summary | P0 | All competitors | Low | Dashboard showing intake vs goals |
| Meal categorization (breakfast, lunch, dinner, snacks) | P0 | All competitors | Low | Standard meal slots with timestamps |

## Full Feature Roadmap

### P1 - Post-MVP Core

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| AI photo food logging | MFP, Noom, Lose It!, Yazio, Cronometer | Medium | Take photo of meal, AI estimates calories and macros (on-device model if possible) |
| Micronutrient tracking (vitamins, minerals) | Cronometer (84+ nutrients) | Low (data from USDA) | Track vitamins A-K, iron, calcium, potassium, etc. |
| Custom food/recipe entry | All competitors | Low | Create custom foods and save recipes with per-serving nutrition |
| Meal planning integration | MFP, Lose It!, Yazio | Low | Link to MyRecipes meal planner with auto-calorie logging |
| Weight goal integration | All competitors | Low | Set weight goal, calculate daily calorie target (TDEE calculator) |
| Nutrient reports/charts | Cronometer | Low | Weekly/monthly nutrient intake visualization |
| Quick-add favorites | MFP | Low | Save frequently eaten meals for one-tap logging |

### P2 - Advanced Features

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| Wearable calorie burn sync | MFP, Lose It!, Yazio, Cronometer | Medium (with HealthKit) | Import calories burned from Apple Watch |
| Restaurant menu database | MFP, Lose It! | Medium | Chain restaurant menu items with nutrition data |
| Water intake tracking | MFP, Cronometer, WaterMinder | Low | Daily water goal with quick logging (shared with MyFast) |
| Intermittent fasting integration | Yazio | Low | Show eating window from MyFast, log food only during window |
| Caffeine tracking | WaterMinder | Low | Track daily caffeine intake |
| Food diary/notes | Cronometer | Low | Notes about how foods made you feel |

### P3 - Long-Term

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| CBT/psychology lessons | Noom | High (content creation) | Behavioral coaching for eating habits |
| Community/social features | MFP, Noom | High | Deprioritize for privacy-first app |

## Privacy Competitive Advantage

MyFitnessPal suffered the largest health app data breach in history, exposing 150 million accounts in 2018. MFP shares user location data for advertising. Noom collects 50+ health questions during onboarding and shares data with third-party analytics providers. Cronometer is the best privacy option among competitors but still requires a cloud account.

MyNutrition keeps all food logs entirely on-device. The module uses the public domain USDA FoodData Central database and the open-source Open Food Facts database for barcode scanning. No network requests are required for core functionality. No advertiser, analytics provider, or third party ever sees what you eat.

## Cross-Module Integration

| Module | Integration | Status |
|--------|------------|--------|
| **MyFast** | Eating windows, fasting-nutrition correlation, restrict food logging to eating window | Built (fast-bridge.ts + fasting break quality insight) |
| **MyRecipes** | Auto-log nutrition from planned meals, recipe nutrition calculation | Planned |
| **MyHealth/MyMood** | Meal timing vs next-day energy correlation | Built (meal timing insight detector) |
| **MyWorkouts** | Gym-day calorie delta, protein-workout adherence | Built (detectors ready, pending local workout cache) |
| **MyMeds** | Food-medication interactions, timing recommendations | Planned |
| **MyHabits** | Nutrition logging as a daily habit with streak tracking | Planned |
| **MyBudget** | Food spending vs nutrition value analysis | Planned |

## Nutrition Correlation Engine (NEW)

Added by CEO Review (2026-03-25). 6 insight detectors, all pure functions:

| Detector | Data Source | Min Days | Example Output |
|----------|-----------|----------|----------------|
| Restaurant Impact | Internal | 7 | "Restaurant meals average 340 more calories than home-cooked" |
| Water-Snacking | Internal | 7 | "Days with 8+ glasses: 2.1 snacks. Under 8: 3.8 snacks" |
| Fasting Break Quality | MyFast (ft_ tables) | 14 | "Breaking fast with protein keeps you under calorie goals 73% of the time" |
| Gym Day Delta | MyWorkouts (wo_ tables) | 14 | "You eat 412 more calories on days you skip the gym" |
| Protein-Workout Adherence | MyWorkouts (wo_ tables) | 14 | "You hit protein goals 85% of gym days but only 40% of rest days" |
| Meal Timing Energy | MyMood (mo_ tables) | 30 | "Eating after 9pm correlates with lower next-day energy scores" |

All detectors gracefully degrade when cross-module data is unavailable.
