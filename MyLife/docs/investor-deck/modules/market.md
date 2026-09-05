# MyMarket — Module Audit

**ID:** market | **Prefix:** mk_ | **Tier:** free | **Storage:** supabase (+ SQLite cache)
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Buy, sell, and trade with your community

## User Value
- Listings + categories + photos + watchlist + reviews + saved searches
- Offline browsing via local SQLite cache of Supabase canonical data
- Stripe Connect escrow payments with dispute state machine and refunds
- Signal-style E2E encrypted messaging (ECDH + HKDF + AES-GCM, safety numbers)
- 5-tier progressive seller verification with per-level listing limits

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Listings + categories + photos CRUD | src/cloud/client.ts, src/db/crud.ts | shipped |
| Watchlist, reviews, saved searches | src/cloud/client.ts | shipped |
| Local SQLite cache for offline reads | src/db/schema.ts (16 cache tables) | shipped |
| PostGIS radius search | mk_listings_within_radius RPC | shipped |
| Postgres FTS on title/description | search_vector tsvector | shipped |
| RLS (anon read, auth write) | src/cloud/schema.sql | shipped |
| AES-GCM passphrase encryption | src/encryption.ts | shipped |
| Signal ECDH + HKDF + AES-GCM | src/crypto/secure-messaging.ts | shipped |
| Safety numbers | src/crypto/secure-messaging.ts | shipped |
| Stripe Connect onboarding | src/payments/stripe-connect.ts | shipped |
| Escrow + capture + refund + dispute-triggered refund | src/payments/orchestrator.ts | shipped |
| Stripe webhook processing | src/payments/webhooks.ts | shipped |
| Dispute state machine (7 states) | src/disputes/engine.ts | shipped |
| Filing window + response deadline | src/disputes/engine.ts | shipped |
| Shipping tracking (6 carriers) | src/shipping/tracking.ts | shipped |
| Verification level calc (5 tiers, no-demotion) | src/verification/engine.ts | shipped |
| Services listings + portfolio + availability | V3 cache tables | shipped |
| Block system + reports | cloud schema | shipped |

## Data Model
Prefix `mk_`, schema v3. Cloud tables (12): categories, listings, listing_photos, conversations, messages, watchlist, reviews, seller_stats, saved_searches, reports, blocks + payments/disputes/shipping/verification/service tables. Cache tables (16): 6 core + 10 V3 (offers, payments, disputes, shipments, service_portfolio, service_availability, seller_verification, identity_keys, sessions, prekeys).

## Screens / User Flows
Mobile tabs: Home, Browse, Sell, Messages, Profile. Stack screens: listing-detail, create-listing, edit-listing, chat-thread, category-browser, search-results, seller-profile, checkout, payment-settings, verification, dispute, dispute-detail, shipping-detail, services, service-detail, create-service-listing. 26 mobile route files, 24 web route files.

## Distinctive / Moat-worthy
- Signal-grade E2E crypto for buyer-seller chat (not commodity marketplace chat)
- Stripe Connect escrow with dispute-triggered refund calculation baked into tested engine (54 payment tests pass)
- 5-tier progressive verification raises listing limits as trust grows — no instant marketplace flooding

## Gaps vs competitors
- No ratings-aggregate display UI verified (seller_stats table exists, surface pending)
- No AI-driven scam/fraud detection beyond verification level
- Marketplace liquidity is cold start — competes with Facebook Marketplace network effects

## Investor-facing hook
Craigslist simplicity plus Stripe escrow plus Signal-grade crypto, inside a suite with 30 other reasons to keep the app installed.
