# MyDining — Module Audit

**ID:** dining | **Prefix:** dn_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v6)
**One-line promise:** Remember every meal

## User Value
- A personal restaurant diary: visits, dishes, wines, companions, photos.
- Wishlist of places to try plus reservations log.
- Map view of your actual eating history, not Yelp's.
- Year-in-review engine for dining habits.
- Import dishes and visits from email confirmations and URLs.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Restaurants + visits + dishes | modules/dining/src/db/schema.ts (dn_restaurants, dn_visits, dn_dishes) | shipped |
| Companions + tags | modules/dining/src/db/schema.ts (dn_companions, dn_tags, dn_restaurant_tags) | shipped |
| Photos per visit/dish | modules/dining/src/db/schema.ts (dn_photos) | shipped |
| Wine log | modules/dining/src/db/schema.ts (dn_wines) | shipped |
| Reservations + imports | modules/dining/src/db/schema.ts (dn_reservations, dn_imports) | shipped |
| Wishlist/watchlist | modules/dining/src/db/schema.ts (dn_watchlist) | shipped |
| CSV importer | modules/dining/src/engine/csv-importer.ts | shipped |
| Email confirmation parser | modules/dining/src/engine/email-parser.ts | shipped |
| URL parser (menu/reservation) | modules/dining/src/engine/url-parser.ts | shipped |
| Deep-link handler | modules/dining/src/engine/deeplink.ts | shipped |
| Photo pipeline | modules/dining/src/engine/photo-pipeline.ts | shipped |
| Year-in-review engine | modules/dining/src/engine/year-review.ts | shipped |
| Map view | apps/mobile/app/(dining)/map.tsx, apps/web/app/dining/map/ | shipped |

## Data Model
- dn_restaurants, dn_visits, dn_dishes, dn_wines, dn_companions, dn_tags, dn_restaurant_tags, dn_photos, dn_reservations, dn_imports, dn_watchlist, dn_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(dining)/ -- index, restaurant/, visit/, visits, dish/, wine/, reservation/, reservations, wishlist, import, map, year-review, settings.
- Web: apps/web/app/dining/ -- page, restaurant/, visit/, visits/, dish/, wine/, reservation/, reservations/, wishlist, import/, map/, year-review/, settings/, actions.ts.

## Distinctive / Moat-worthy
- A private dining diary disconnected from review/advertising ecosystems (Yelp, Google Maps, OpenTable).
- Email-confirmation parser auto-populates visits without a Gmail API dependency.
- Wine log and companions as first-class entities (not a comment field).
- Year-in-review gives memoir-grade output without surrendering location data.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- Not present in COMPETITIVE-MATRIX.md. Likely peers: Beli, Where to Eat, Foursquare City Guide. Add a row in next matrix refresh.

## Investor-facing hook
MyDining turns the restaurant memories that users currently hand to Yelp and Google into a private, exportable life archive with built-in import from email.
