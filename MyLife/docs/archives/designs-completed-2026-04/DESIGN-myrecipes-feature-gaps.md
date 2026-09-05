# MyRecipes - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05, updated 2026-03-25)
**Status:** Implemented (rc_-prefixed tables only after V7 identity refocus)

## Current State

MyRecipes is a privacy-first recipe management module focused on the core cooking loop: **Import -> Plan -> Shop -> Cook**. It includes full recipe CRUD, an ingredient parser with unit conversion, recipe scaling, a step-by-step cooking mode with voice commands and multiple timers, a weekly meal planner, shopping lists with aisle grouping, a pantry tracker with barcode lookup and expiration alerts, per-recipe nutrition calculation, URL and video import, AI food recognition, recipe collections, token-based sharing, and print-friendly layouts.

Garden tracking and event hosting were shed in V7 (tables dropped). These domains are now owned by the MyGarden and MyRSVP modules respectively. MyRecipes orchestrates cross-module journeys via deep links ("cook from what I grew", "plan food for guests") without owning their data.

The module uses local SQLite storage with the `rc_` table prefix.

## Competitors Analyzed

| Competitor | Pricing | Platform | Cloud Required |
|-----------|---------|----------|---------------|
| Paprika | $4.99 (iOS), $29.99 (Windows/Mac) one-time | iOS, Android, Mac, Windows | Optional sync |
| Mela | $4.99 one-time | iOS, Mac | No |
| Plan to Eat | $49.97/yr | Web, iOS, Android | Yes |
| Mealime | Free/Pro $5.99/mo | iOS, Android | Yes |
| Whisk/Samsung Food | Free | iOS, Android, Web | Yes |
| Eat This Much | $5/mo | Web, iOS, Android | Yes |

## Completed Features (All Competitive Parity Achieved)

All features from the original competitive analysis have been implemented:

| Feature | Status | Implementation |
|---------|--------|----------------|
| Video recipe import | Done | `import/video-import.ts` -- YouTube, TikTok, Instagram via metadata extraction |
| Paper recipe OCR | Done | `pantry/food-recognition.ts` + `import/ai-recipe-extract.ts` -- Claude Vision API |
| Nutritional info per recipe | Done | `nutrition/recipe-nutrition.ts` -- auto-calculated from pantry nutrition data with fuzzy matching |
| Print recipes | Done | `print/recipe-template.ts` -- HTML template with print stylesheet, photo support |
| Recipe sharing | Done | `share/recipe-share.ts` -- token-based with 30-day expiry and view count |
| Voice control in cooking | Done | `voice/voice-commands.ts` -- next/prev step, start/stop timer, read ingredients, go to step N |

## Remaining Feature Gaps (From Meal-Planning Competitors)

With the expanded competitor set (Mealime, Whisk, Eat This Much), three gaps emerged that the recipe-only competitor set did not surface:

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Auto-generated meal plans | P2 | Mealime, Eat This Much | Medium | Generate weekly plans from recipe library based on dietary preferences, cuisine variety, and time constraints. Current meal planner is manual-only. |
| Macro/calorie goal targeting | P2 | Eat This Much | Medium | Set daily calorie/macro targets and auto-fill meal plans to hit them. Requires nutrition data coverage for most recipes. |
| Ingredient substitution suggestions | P3 | Whisk/Samsung Food | Low | Suggest swaps when a recipe ingredient is missing from pantry (e.g., Greek yogurt for sour cream). Can use a static substitution table. |

## Privacy Competitive Advantage

MyRecipes is the most feature-rich private recipe app available. Every competitor with comparable meal-planning features (Mealime, Whisk, Eat This Much) requires cloud accounts and sends data to their servers. MyRecipes stores everything locally, works offline, and charges no recurring fee beyond the MyLife suite subscription. The only comparable private options (Paprika, Mela) lack meal planning depth, nutrition tracking, and video import.

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyNutrition** | Share food composition database for calorie/macro calculations. Recipes auto-populate nutrition logs. |
| **MyFast** | Meal planning respects fasting windows. Suggest recipes that fit within eating periods. |
| **MyGarden** | Deep link: "Cook from what I grew." Garden surfaces harvests, MyRecipes fuzzy-matches against recipe ingredients. |
| **MyBudget** | Track grocery spending from shopping lists. Estimate recipe costs from ingredient prices. |
| **MyHealth** | Surface dietary patterns and their health correlations over time. |
| **MyRSVP** | Deep link: "Plan food for guests." RSVP surfaces guest count and dietary preferences, MyRecipes adjusts meal plan servings. |
