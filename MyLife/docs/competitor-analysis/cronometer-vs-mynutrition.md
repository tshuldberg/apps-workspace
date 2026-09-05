# Cronometer vs MyNutrition: Feature Comparison

**Date:** 2026-03-28
**Source:** Screen recording of Cronometer iOS app (10 min walkthrough)
**Screenshots:** `docs/competitor-analysis/nutrition-app-screens/labeled/`

## Summary

Cronometer is a mature nutrition tracking app focused on micronutrient detail, multiple food databases (USDA, NCCDB, CNF), device integrations, and data quality scoring. Our MyNutrition module already covers most core features and exceeds Cronometer in several areas (AI photo logging, cross-module intelligence, community/challenges). The main gaps are in **onboarding UX**, **weight tracking as a dedicated flow**, **device integrations**, **daily report generation**, and **diary timestamp/group customization**.

---

## Feature-by-Feature Comparison

| # | Cronometer Feature | MyNutrition Has It? | Notes |
|---|---|---|---|
| **ONBOARDING** | | | |
| 1 | Multi-step onboarding wizard (7 steps) | NO | We jump straight to diary. No guided setup. |
| 2 | Profile setup (gender, birthday, height, weight) | PARTIAL | Goals screen has activity level + TDEE calc, but no structured onboarding flow |
| 3 | Activity level selector with descriptions | YES | Goals screen has Sedentary/Light/Moderate/Active |
| 4 | Weight goal setting with safe-range warnings | PARTIAL | Goals has objective wizard but no safe-range warnings |
| 5 | Goal rate selector (lbs/week) | NO | We set calorie targets directly, no weight-loss-rate slider |
| **DIARY (Daily Food Log)** | | | |
| 6 | Date navigation (prev/next day) | YES | Diary has date navigator |
| 7 | Energy summary rings (Consumed/Burned/Remaining) | YES | Diary has macro summary with progress bars |
| 8 | Meal groups (Breakfast/Lunch/Dinner/Snacks) | YES | Same grouping |
| 9 | Water tracking widget in diary | YES | Water tracking via dedicated service |
| 10 | Diary timestamps per entry | NO | Cronometer Gold feature; we don't timestamp individual entries |
| 11 | Diary groups (custom meal categories) | NO | Cronometer Gold; we only have fixed B/L/D/S |
| 12 | Highlighted nutrients carousel in diary | PARTIAL | Our dashboard shows micros but not inline in diary |
| 13 | Nutrient detail popup (RDA bar, UL indicator) | PARTIAL | Food detail shows nutrients but no RDA bar visualization with UL |
| **FOOD SEARCH & DATABASE** | | | |
| 14 | Food search with tabs (All/Favorites/Custom) | YES | We have All/USDA/Packaged/Custom/Recent tabs |
| 15 | Multiple database sources (NCCDB, USDA, CNF) | PARTIAL | We have USDA + Open Food Facts + FatSecret. No NCCDB/CNF |
| 16 | Database filter in search options | YES | Our tab-based filtering covers this |
| 17 | Sort options (A-Z, Most Recent, Best Match) | NO | We don't expose sort options |
| 18 | Multi-add mode (log multiple foods at once) | NO | We log one food at a time |
| 19 | Favorites system | NO | No favorites/star system for foods |
| **BARCODE SCANNING** | | | |
| 20 | Camera barcode scanner | YES | Scan screen with camera |
| 21 | Manual barcode entry (TYPE BARCODE button) | YES | Manual barcode entry fallback |
| 22 | Flash toggle | NO | No flash/torch control on scanner |
| **FOOD CREATION** | | | |
| 23 | Create custom food | YES | Custom foods via search and AI photo |
| 24 | Create recipe (multi-ingredient) | NO | No recipe builder (that's MyRecipes module) |
| 25 | Create meal (reusable meal template) | NO | No saved meal templates |
| 26 | Recipe importer (from URLs) | NO | Cronometer Gold feature; not in our module |
| **AI / PHOTO FEATURES** | | | |
| 27 | Photo log (AI food identification) | YES | Claude-powered photo analysis (we exceed Cronometer here) |
| **TARGETS & GOALS** | | | |
| 28 | Targets summary (Energy/Protein/Net Carbs/Fat tabs) | YES | Goals screen + dashboard cover this |
| 29 | Top energy/macro sources links | NO | We don't show "top sources" for each macro |
| 30 | Target scheduler (different targets per weekday) | NO | Cronometer Gold; we use fixed daily goals |
| **DASHBOARD & DISCOVER** | | | |
| 31 | Dashboard tab with charts | YES | Dashboard with macro rings + micronutrient grid |
| 32 | Charts tab (trend charts) | YES | Trends screen with 7/30/90 day views |
| 33 | Report tab | PARTIAL | We have CSV export but no formatted daily report |
| 34 | Snapshot tab | NO | No "snapshot" summary view |
| **ENERGY & METABOLISM** | | | |
| 35 | Energy summary (Consumed/Expenditure/Remaining) | YES | Energy balance via sync service |
| 36 | Energy expenditure settings (BMR, TEF, activity) | YES | calculateBMR(), applyActivityMultiplier(), TEF toggle |
| 37 | Baseline activity level with imported activity | YES | HealthKit sync for active calories |
| 38 | Thermic Effect of Food (TEF) toggle | NO | We calculate BMR + activity but no explicit TEF toggle |
| **WEIGHT TRACKING** | | | |
| 39 | Weight logging with timestamp | NO | No dedicated weight tracking (Health module territory) |
| 40 | Weight change chart with date ranges | NO | No weight chart in nutrition module |
| 41 | Weight goal target line on chart | NO | No weight visualization |
| 42 | Weight trend on dashboard | NO | Dashboard shows nutrition, not weight |
| **FASTING** | | | |
| 43 | Built-in fasting timer | PARTIAL | We show eating window status via MyFast integration, but no built-in timer |
| 44 | Fasting schedule/quick start | NO | Deferred to MyFast module |
| **SLEEP** | | | |
| 45 | Sleep breakdown on dashboard | NO | Not in scope for nutrition module |
| **DEVICE INTEGRATIONS** | | | |
| 46 | Fitbit, Garmin, Whoop, Withings, Polar, Oura | NO | We only have HealthKit. No direct device integrations |
| 47 | Dexcom (CGM) | NO | No continuous glucose monitor integration |
| 48 | Keto-Mojo | NO | No ketone meter integration |
| 49 | Suunto | NO | No Suunto integration |
| **SETTINGS & DISPLAY** | | | |
| 50 | Units (Calories/kJ) | YES | Unit toggle in settings |
| 51 | Keyboard type selection | NO | No keyboard type preference |
| 52 | Show/hide diary widgets (energy, macros, water, nutrients) | NO | We show all widgets; no toggle |
| 53 | Summary column selector | NO | Fixed summary display |
| **REPORTS & DATA** | | | |
| 54 | Daily report (printable) | NO | We have CSV export but no formatted daily report |
| 55 | Print reports (PDF for health professionals) | NO | No PDF generation |
| 56 | Data quality score | NO | No data quality/confidence scoring |
| 57 | All Targets percentage score | NO | No aggregate target completion score |
| **SOCIAL** | | | |
| 58 | Sharing settings | YES | Community has visibility controls |
| 59 | Referral program (rewards) | NO | No referral/rewards system (subscription-level concern) |
| **ALL-TIME STATS** | | | |
| 60 | Logging streak tracker | NO | No streak tracking |
| 61 | All-time stats (foods, exercises, biometrics, fasts) | NO | No aggregate lifetime stats view |
| **QUICK ADD ACTIONS** | | | |
| 62 | Add menu grid (Suggest Food, Add Food, Scan, Biometric, Note, Fast, Exercise, Photo) | PARTIAL | FAB menu has Search/Scan/Photo/Goals/Log/Community |
| 63 | Add exercise from nutrition app | NO | Exercise logging is in MyWorkouts |
| 64 | Add biometric from nutrition app | NO | Biometrics in Health module |
| 65 | Add note to diary | NO | No diary notes feature |
| **EDUCATIONAL CONTENT** | | | |
| 66 | User manual (in-app, with references) | NO | No in-app educational content |
| 67 | Nutrient function descriptions | NO | No nutrient education text |

---

## Where MyNutrition EXCEEDS Cronometer

| Feature | MyNutrition | Cronometer |
|---------|-------------|------------|
| AI photo food identification | Claude-powered with multi-item detection | Basic photo log (Gold only) |
| Cross-module intelligence | 6 algorithmic insight detectors (restaurant impact, water-snacking correlation, fasting break quality, meal timing energy, gym day delta, protein adherence) | None |
| Community challenges | Create/join challenges, leaderboards | None |
| Activity feed | Social feed with cheers | None |
| Connection system | Friend connections with share codes | Basic sharing only |
| Micronutrient deficiency detection | Automated deficiency analysis | Manual review only |
| Macro ratio trends | 7/30/90 day trend analysis | Charts tab (similar) |
| Offline-first privacy | Zero telemetry, 100% local | Cloud-based account required |
| CSV export | Food log + summary CSVs | PDF reports (Gold only) |

---

## Priority Gaps to Close

### P0 - High Impact, Should Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1 | **Onboarding wizard** | First-run experience is critical for retention. Cronometer guides users through profile, activity, goals, and weight target before showing the app. | Medium |
| 2 | **Food favorites** | Power users re-log the same foods daily. Favorites + recent foods makes logging 3x faster. | Small |
| 3 | **Saved meal templates** | "Weekday Breakfast" one-tap logging is a killer feature for daily users. | Medium |
| 4 | **Logging streak** | Gamification drives daily engagement. Simple day count + longest streak. | Small |
| 5 | **Sort options in food search** | A-Z, Most Recent, Best Match sorting helps find foods faster. | Small |
| 6 | **Multi-add mode** | Log multiple foods without leaving search. Reduces friction for meal logging. | Medium |

### P1 - Nice to Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 7 | **Daily report view** | Formatted daily nutrition report (not just CSV). Shows all targets, top sources, data quality. | Medium |
| 8 | **Aggregate target score** | "All Targets: 72%" single number showing how well user hit all nutrient goals. | Small |
| 9 | **Diary timestamps** | Track when each food was eaten, not just which meal category. | Small |
| 10 | **Diary notes** | Quick text notes attached to diary entries. | Small |
| 11 | **Flash toggle on barcode scanner** | Minor UX improvement for scanning in low light. | Small |
| 12 | **TEF toggle** | Thermic Effect of Food as explicit setting. | Small |

### P2 - Consider Later

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 13 | **Weight tracking in nutrition** | Could show weight trend alongside nutrition data. But overlaps with Health module. | Large |
| 14 | **Device integrations** (Fitbit, Garmin, etc.) | Major integration effort. HealthKit already covers most fitness devices indirectly. | Large |
| 15 | **Recipe importer from URL** | Scrape recipe websites. Overlaps with MyRecipes module. | Large |
| 16 | **Custom diary groups** | Let users create custom meal categories beyond B/L/D/S. | Medium |
| 17 | **Nutrient education content** | In-app descriptions of what each nutrient does. | Medium |
| 18 | **Data quality scoring** | Score confidence of logged data. Interesting but complex. | Large |

### Out of Scope (Handled by Other Modules)

| Feature | Module |
|---------|--------|
| Fasting timer | MyFast |
| Weight tracking | MyHealth |
| Exercise logging | MyWorkouts |
| Sleep tracking | MyHealth/MyMood |
| Recipe management | MyRecipes |
| Biometrics | MyHealth |

---

## Screenshot Reference

All labeled screenshots are in:
```
docs/competitor-analysis/nutrition-app-screens/labeled/
├── 01-onboarding/     (9 images)
├── 02-dashboard/      (2 images)
├── 03-diary/          (3 images)
├── 04-food-search/    (3 images)
├── 05-barcode-scanner/ (3 images)
├── 06-targets-summary/ (2 images)
├── 07-energy-charts/  (2 images)
├── 08-foods-tab/      (1 image)
├── 09-custom-meals/   (2 images)
├── 10-weight-tracking/ (2 images)
├── 11-fasting/        (1 image)
├── 12-settings/       (2 images)
├── 13-devices/        (2 images)
├── 14-reports/        (1 image)
├── 15-subscription/   (3 images)
├── 16-referrals/      (1 image)
├── 17-user-manual/    (2 images)
├── 18-add-actions/    (1 image)
├── 19-nutrient-detail/ (1 image)
├── 20-all-time-stats/ (1 image)
├── 21-energy-expenditure/ (1 image)
└── 22-energy-summary/ (1 image)
```
