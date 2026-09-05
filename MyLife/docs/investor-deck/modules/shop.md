# MyShop Module Audit

**ID:** shop | **Prefix:** sh_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Your private shopping memory

## User Value
- Universal wishlists (across sites, with priority and photos)
- Purchase journal with receipt capture and satisfaction tracking
- Warranty + return deadline tracker
- Size and brand preference memory
- Gift shopping per person + spending awareness, all local

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Module scaffold + sh_settings | src/db/schema.ts | shipped (P0) |
| Wishlist screens | app/(shop)/wishlist, web/shop/wishlist | shipped |
| Purchases screen | app/(shop)/purchases.tsx | shipped |
| Warranties screen | app/(shop)/warranties.tsx | shipped |
| Warranty detail | app/(shop)/warranty | shipped |
| Gifts screen | app/(shop)/gifts | shipped |
| Sizes screen | app/(shop)/sizes | shipped |
| Spending screen | app/(shop)/spending | shipped |
| Preferences screen | app/(shop)/preferences | shipped |
| Purchase detail | app/(shop)/purchase | shipped |
| Settings | app/(shop)/settings.tsx | shipped |
| Placeholder types (WishlistInput, PurchaseInput, etc.) | src/types.ts | P0 stubs |

## Data Model
Prefix `sh_`, schema v8 per getMigrations(). V1 live table: `sh_settings`. Phased roadmap through P8 adds wishlist, purchases, warranties, preferences, gifts, spending, comparisons, cross-module integrations (budget, friends, closet).

## Screens / User Flows
Mobile tabs: Wishlist, Purchases, Warranties, Settings (+ gifts, sizes, spending, preferences, purchase detail, warranty detail as secondary screens). Web: full route parity.

## Distinctive / Moat-worthy
- Zero cloud, zero tracking, "shopping intent data never leaves device"
- Shopping memory integrates with closet, budget, and friends modules (planned)
- Competes with Amazon Wishlist without surveillance or upsell

## Gaps vs competitors
- Types + CRUD are still placeholder interfaces, business logic lands P1-P7
- No price comparison scrapers or deal alerts yet
- No retailer integrations (by design for privacy)

## Investor-facing hook
A private Amazon Wishlist + receipt vault + warranty tracker in one, rebuilding shopping memory without selling intent data.
