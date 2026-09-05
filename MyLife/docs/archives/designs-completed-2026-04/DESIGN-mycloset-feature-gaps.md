# MyCloset - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete (all competitive features implemented)
**Updated:** 2026-03-24 (CEO review GP-17-4a)

## Current State

Full-featured wardrobe management module with 100% competitive feature parity. 3 schema versions, 13+ tables, 10 pure-function engine files, full CRUD across all entities, 40+ tests. Privacy-first, zero network calls, all data local SQLite.

### Implementation Summary

| Version | Features | Tables Added |
|---------|----------|-------------|
| V1 | Wardrobe catalog, outfits, wear logs, tags, settings, donation candidates, dashboard | 8 (cl_items, cl_outfits, cl_outfit_items, cl_wear_logs, cl_wear_log_items, cl_tags, cl_item_tags, cl_settings) |
| V2 | Laundry tracking (care instructions, auto-dirty, wears-since-wash), packing lists | 3 (cl_laundry_events, cl_packing_lists, cl_packing_list_items) + 3 columns on cl_items |
| V3 | Wishlist, capsule wardrobes, outfit suggestions with feedback, weather cache | 5 (cl_wishlist_items, cl_capsules, cl_capsule_items, cl_suggestion_feedback, cl_weather_cache) |

### Engine Files (10 pure-function modules)

| Engine | Purpose |
|--------|---------|
| analytics.ts | Wardrobe value, cost-per-wear, dashboard summary |
| cpw.ts | CPW leaderboard, by-category averages, median/summary stats |
| weather.ts | 5-range temp scoring, season matching, layer labels, recommendations |
| seasonal.ts | Season detection, rotation reminders, items to store/activate, hemisphere support |
| outfit-suggest.ts | Outfit generation with color harmony, recency weighting, thumbs-up/down feedback |
| capsule.ts | Versatility scoring, capsule building, gap analysis, outfit combo estimation |
| color.ts | 80+ color name normalization, distribution charts, insights, harmony pairs |
| laundry.ts | Average wears between washes, grouping dirty items by care instructions |
| packing.ts | Season inference, trip-aware packing suggestions from wardrobe |
| export.ts | Full data bundle serialization for backup/export |

## Competitors Analyzed

| Competitor | Pricing | Focus |
|-----------|---------|-------|
| Cladwell | $96/yr | AI-powered wardrobe management, outfit suggestions, capsule wardrobe building |
| Indyx | Free | 4M users, digital closet, laundry tracking, styling tips |
| Clueless | $69/yr | Weather-aware outfits, calendar integration, AI suggestions |
| Stylebook | $5.99 one-time | Cost-per-wear, packing lists, style statistics |
| Alta | Free/premium | AI outfit generation, background removal, virtual try-on |

## Feature Parity Status

| Feature | Priority | Status | Implementation |
|---------|----------|--------|---------------|
| Wardrobe catalog | P0 | DONE | cl_items with 11 categories, photo URI, brand, color, condition |
| Category/tag organization | P0 | DONE | cl_tags + cl_item_tags M2M, multi-tag filtering in listClothingItems |
| Outfit builder | P0 | DONE | cl_outfits + cl_outfit_items M2M, dedup, occasion/season tagging |
| Outfit calendar/log | P0 | DONE | cl_wear_logs + cl_wear_log_items, date-based, outfit-linked |
| Wear count tracking | P0 | DONE | times_worn on cl_items, auto-incremented on logWearEvent |
| AI outfit suggestions | P1 | DONE | engine/outfit-suggest.ts, color harmony, feedback learning |
| Weather-aware recommendations | P1 | DONE | engine/weather.ts, 5 temp ranges, season/cleanliness/recency scoring |
| Laundry tracking | P1 | DONE | V2 schema, care_instructions, auto_dirty_on_wear, wears_since_wash |
| Packing list generator | P1 | DONE | engine/packing.ts, season-aware suggestions, custom items |
| Cost-per-wear analysis | P1 | DONE | engine/cpw.ts, leaderboard, by-category, summary with median |
| Donation suggestions | P1 | DONE | listDonationCandidates, configurable threshold (default 365 days) |
| Shopping wishlist | P2 | DONE | V3 schema, priority levels, purchase tracking, summary |
| Capsule wardrobe builder | P2 | DONE | engine/capsule.ts, versatility scoring, gap analysis, combo estimation |
| Seasonal rotation reminders | P2 | DONE | engine/seasonal.ts, hemisphere-aware, advance days configurable |
| Color palette analysis | P2 | DONE | engine/color.ts, 80+ colors, distribution, insights, harmony pairs |
| Data export | -- | DONE | engine/export.ts, full bundle serialization |
| Style board/mood board | P2 | NOT PLANNED | Low ROI for privacy-first app, no cloud image sharing |

## Remaining Work (non-competitive, infrastructure)

| Item | Priority | Notes |
|------|----------|-------|
| Web UI build | P1 | Currently fallback stub. Business logic is 100% ready, needs Next.js pages. |
| V3 test coverage | P2 | 40 tests cover V1/V2. V3 features (wishlist, capsule, suggestions, weather, seasonal, color) need tests. |
| Photo background removal | P2 | On-device ML for clean item photos. Nice-to-have, not competitive blocker. |

## Privacy Competitive Advantage

Wardrobe apps collect deeply personal data: photos of everything you own, body measurements, style preferences, purchase history, and daily outfit choices. This data profile is valuable for fashion retailers and advertisers:

- **Cladwell** charges $96/yr and requires a cloud account. All wardrobe photos and outfit data are stored on their servers. They partner with fashion brands for recommendations (potential data sharing incentive).
- **Generic fashion apps** often monetize through affiliate links and targeted ads based on wardrobe data.

MyCloset's positioning: **Your wardrobe stays on your device.** No cloud upload of clothing photos, no body measurement data leaving the device, no purchase history shared with fashion brands. Photos and outfit data stored locally in SQLite. The combination of $0 cost and complete privacy makes Cladwell's $96/yr cloud-dependent model hard to justify.

## Cross-Module Integration

| Module | Integration Point |
|--------|------------------|
| MyBudget | Clothing purchase spending tracked and categorized. Cost-per-wear data enriches budget insights |
| MyHabits | Daily outfit planning as a morning habit. Outfit logging tracked as consistent routine |
| MyTrails | Activity-appropriate clothing suggestions for planned trips and outdoor activities |
| MyJournal | Outfit photos can be journal entry attachments for daily life documentation |
| MySurf | Weather data could feed outfit weather recommendations |
