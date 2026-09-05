# MyNutrition — Module Audit

**ID:** nutrition | **Prefix:** nu_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.3.0
**One-line promise:** Your food diary stays on your device. Your insights span your whole life.

## User Value
- Food diary with barcode scan (Open Food Facts), AI photo logging (Claude Vision), USDA DB
- Water tracking with custom containers, unit conversion, weekly totals
- Energy balance: BMR + TDEE + activity multiplier, HealthKit active-calorie sync, write-back
- Meal templates, favorites, recent foods, daily notes with tags, restaurant menu catalog
- Cross-module intelligence: nutrition + fasting + workouts + mood insight engine

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Food + nutrient + food log CRUD | src/db (index.ts exports) | shipped |
| Daily goals (calories, macros, micros) | src/db (daily_goals) | shipped |
| FTS5 search on foods | src/db/schema (nu_foods_fts) | shipped |
| Barcode cache + lookup | src/barcode, src/db (nu_barcode_cache) | shipped |
| USDA + Open Food Facts + FatSecret unified search | src/api | shipped |
| AI photo logging (Claude Vision) | src/ai | shipped |
| Meal templates + favorites + recent | src/db | shipped |
| Water tracking (ml/oz, containers, weekly) | src/water | shipped |
| Energy balance (BMR, TDEE, multipliers) | src/sync | shipped |
| HealthKit calorie sync + write-back | src/sync | shipped |
| Daily food-diary notes with tags | src/notes | shipped |
| Restaurant catalog + menu items + logging | src/restaurant | shipped |
| Nutrition insights (restaurant impact, water snacking, fasting break, meal timing, gym day delta, protein workout) | src/engine | shipped |
| Daily report + streak info | src/stats | shipped |
| Micronutrient deficiency detection | src/stats | shipped |
| CSV export (log + summary) | src/export | shipped |
| MyFast eating window integration | src/integration | shipped |
| Community (profiles, feed, challenges, cheers, leaderboards, blocks) | src/community | shipped |
| Copy food log (day-to-day) | src/db | shipped |

## Data Model
Prefix `nu_`, schema v8. V1 tables: nu_foods, nu_nutrients, nu_food_nutrients, nu_daily_goals, nu_settings, nu_food_log, nu_food_log_items, nu_barcode_cache, nu_foods_fts. V2-V8 migrations add favorites, meal templates, water, energy balance, daily notes, restaurants, community (profiles/connections/feed/challenges/blocks).

## Screens / User Flows
Mobile tabs: Home, Diary, Search, Trends, Community, Settings. Stack screens: dashboard, food-detail, add-food, scan, photo, meal-edit, water, energy-balance, sync-settings, diary-notes, restaurants, restaurant-detail, add-restaurant, community-profile, community-challenge, community-feed, insights. 17 mobile route files, 18 web route files.

## Distinctive / Moat-worthy
- Three food APIs (USDA + OFF + FatSecret) + AI photo fallback — no competitor unifies them
- Cross-module insight engine correlates nutrition with MyFast, MyWorkouts, MyMood
- Community system (profiles + connections + feed + challenges + leaderboards) is local-first, privacy-controlled

## Gaps vs competitors
- No continuous-glucose integration inside nutrition (lives in @mylife/meds)
- No MacroFactor-style adaptive TDEE auto-tuning (fixed multipliers)
- Community surface exists but network effects cold start

## Investor-facing hook
MyFitnessPal + Yazio + MacroFactor + Lose It, minus ads and data brokering, plus nutrition-aware cross-module insights no single-purpose tracker can produce.
