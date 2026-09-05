# MyCloset — Module Audit

**ID:** closet | **Prefix:** cl_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v3)
**One-line promise:** Your wardrobe, fully private

## User Value
- A digital wardrobe with cost-per-wear analytics so you actually know what pays off.
- Outfit suggestions that learn from feedback and adapt to weather and season.
- Laundry tracking with wears-since-wash and auto-dirty logic.
- Packing list generator that pulls from your own wardrobe, not a generic checklist.
- Capsule wardrobe builder, wishlist, and color palette analysis.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Wardrobe inventory + tags | modules/closet/src/db/schema.ts (cl_items, cl_tags, cl_item_tags) | shipped |
| Outfits + wear logs | modules/closet/src/db/schema.ts (cl_outfits, cl_outfit_items, cl_wear_logs, cl_wear_log_items) | shipped |
| Laundry engine | modules/closet/src/engine/laundry.ts, db (cl_laundry_events) | shipped |
| Cost-per-wear | modules/closet/src/engine/cpw.ts | shipped |
| Seasonal rotation (hemisphere aware) | modules/closet/src/engine/seasonal.ts | shipped |
| Weather-aware recommendations | modules/closet/src/engine/weather.ts, db (cl_weather_cache) | shipped |
| Packing lists | modules/closet/src/engine/packing.ts, db (cl_packing_lists, cl_packing_list_items) | shipped |
| AI outfit suggestions + feedback learning | modules/closet/src/engine/outfit-suggest.ts, db (cl_suggestion_feedback) | shipped |
| Wishlist | modules/closet/src/db/wishlist.ts (cl_wishlist_items) | shipped |
| Capsule wardrobe + versatility score | modules/closet/src/engine/capsule.ts, db (cl_capsules, cl_capsule_items) | shipped |
| Color palette analysis | modules/closet/src/engine/color.ts | shipped |
| Donation candidate detection | modules/closet/src/engine/analytics.ts | shipped |
| Full data export | modules/closet/src/engine/export.ts | shipped |

## Data Model
- cl_items, cl_tags, cl_item_tags, cl_outfits, cl_outfit_items, cl_wear_logs, cl_wear_log_items, cl_laundry_events, cl_packing_lists, cl_packing_list_items, cl_suggestion_feedback, cl_wishlist_items, cl_capsules, cl_capsule_items, cl_weather_cache, cl_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(closet)/ -- index, wardrobe, outfits, calendar, stats, rotation, trends, suggestions, weather-score, wishlist, cpw, color-analysis, settings.
- Web: apps/web/app/closet/ -- page, outfits/, calendar/, stats/, settings/.

## Distinctive / Moat-worthy
- Cost-per-wear engine with leaderboards and category medians, not a vanity chart.
- Outfit suggestion learns from explicit user feedback (not ads/affiliate revenue).
- Local weather-aware scoring with 5-range temp model and layer labels.
- Capsule wardrobe versatility + combo estimation is absent from Indyx, Alta, and Stylebook.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- None -- section 24 marks all features shipped.

## Investor-facing hook
MyCloset is the only wardrobe app that combines stylebook-grade cost analytics with AI outfit suggestions while refusing to monetize your closet to fast-fashion affiliates.
