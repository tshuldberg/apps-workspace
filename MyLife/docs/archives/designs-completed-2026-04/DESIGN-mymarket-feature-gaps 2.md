# MyMarket - Feature Gap Design Doc
**Source:** Module Spec Design (2026-03-10)
**Status:** Backend 90% complete, UI not started
**Updated:** 2026-03-24 (CEO review GP-17-12a)

## Current State

MyMarket is a hub module at 90% backend completeness. All 7 subsystems are implemented: core marketplace, dual encryption (AES-GCM + Signal-style E2E), Stripe Connect payments with escrow, dispute resolution state machine, shipping tracking (6 carriers), seller verification (5 tiers), and service discovery. Remaining P0: UI screens and cross-module listing integration. This document analyzes the competitive landscape and identifies feature gaps relative to leading marketplace platforms.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| Facebook Marketplace | Free (ad-supported) | General marketplace | Massive audience, social trust, Messenger integration |
| OfferUp | Free (fee on shipped) | General marketplace | TruYou verification, dedicated marketplace UX |
| Craigslist | Free | Classifieds | Simple, free, massive traffic |
| Mercari | Free (10% seller fee) | Shipping marketplace | Buyer protection, shipping labels, instant pay |
| Poshmark | Free (20% seller fee) | Fashion marketplace | Social selling, authentication service |
| NextDoor | Free (ad-supported) | Local community | Neighborhood trust, verified addresses |
| Depop | Free (10% seller fee) | Fashion/vintage | Gen Z audience, social shopping |
| Letgo (merged with OfferUp) | Free | General marketplace | AI photo recognition, simple listing flow |

## Feature Comparison Matrix

| Feature | FB Marketplace | OfferUp | Craigslist | Mercari | MyMarket |
|---------|---------------|---------|------------|---------|---------|
| Free listings | Yes | Yes | Yes | Yes | Yes (built) |
| Seller fees | No | 12.9% shipped | No | 10% | None (built) |
| User profiles | Yes (Facebook) | Yes | No | Yes | Yes (social profiles, built) |
| Seller ratings | Yes | Yes | No | Yes | Yes (built, 5-tier verification) |
| In-app messaging | Yes (Messenger) | Yes | Email relay | Yes | Yes (built, E2E encrypted) |
| Shipping labels | Yes | Yes | No | Yes | Tracking only (built, no label gen) |
| Location filtering | Yes | Yes | Yes | No | Yes (built, PostGIS) |
| Full-text search | Yes | Yes | Basic | Yes | Yes (built, tsvector) |
| Photo upload | Yes (multiple) | Yes (multiple) | Yes (limited) | Yes (multiple) | Yes (1-10, EXIF stripped) |
| Offer system | Yes | Yes | No | Yes | Yes (built, counter-offers) |
| Categories | Yes | Yes | Yes | Yes | Yes (built, hierarchical) |
| Saved searches | Yes | Yes | No | Yes | Yes (built) |
| Price alerts | Limited | Yes | No | Yes | Yes (built, saved search notify) |
| Content moderation | Yes (AI + manual) | Yes | Flagging only | Yes | Yes (built, report + block) |
| Payment processing | Yes (Meta Pay) | Yes (built-in) | No | Yes (built-in) | Yes (built, Stripe Connect) |
| Buyer protection | Yes | Yes (shipped) | No | Yes | Yes (built, escrow + disputes) |
| Ad targeting | Heavy | Yes | Minimal | Yes | None |
| Data tracking | Heavy | Yes | Minimal | Yes | None |
| Privacy | Poor | Moderate | Good | Moderate | Excellent |

## Feature Gaps vs. Competitors

| Feature | Priority | Status | Competitors That Have It | Notes |
|---------|----------|--------|--------------------------|-------|
| In-app payment processing | P2 | BUILT | FB Marketplace, OfferUp, Mercari, Poshmark | Stripe Connect with escrow, fee splitting, webhooks. `payments/` subsystem |
| Shipping label generation | P2 | PARTIAL | FB Marketplace, OfferUp, Mercari, Poshmark | Tracking built (6 carriers). Label generation not yet integrated (needs carrier API keys) |
| Buyer protection program | P2 | BUILT | FB Marketplace, OfferUp, Mercari | Escrow + dispute resolution state machine. `disputes/engine.ts` |
| AI photo recognition | P3 | NOT STARTED | FB Marketplace, OfferUp (Letgo) | Auto-suggest category, title, and price from listing photos. On-device ML or Claude API |
| Promoted/boosted listings | N/A | EXCLUDED | FB Marketplace, OfferUp | Contradicts privacy-first philosophy. Deliberately excluded |
| Vehicle-specific fields | P2 | NOT STARTED | FB Marketplace, Craigslist, OfferUp | Make, model, year, mileage, VIN lookup. Add as category-specific fields |
| Real estate listings | P3 | NOT STARTED | FB Marketplace, Craigslist | Rental/sale listings with property-specific fields. Complex compliance landscape |
| Job postings | P3 | NOT STARTED | Craigslist, Facebook | Job listings with application flow. Out of scope for initial marketplace |
| Social shopping feed | P2 | NOT STARTED | Poshmark, Depop | Browse listings from followed sellers. Integrates with existing social follow system |
| Authentication service | P3 | NOT STARTED | Poshmark (luxury items) | Verify authenticity of luxury/collectible items |
| QR code meetup | P1 | NOT STARTED | None (novel) | Generate QR code for safe meetup confirmation. Novel safety feature |
| Listing templates | P1 | NOT STARTED | None widely | Save listing templates for recurring categories |
| Cross-module listing | P1 | NOT STARTED | None (unique to MyLife) | "Sell this item" button in MyBooks, MyCloset, etc. Auto-populate listing from module data. Highest-priority remaining feature |
| Group marketplaces | P2 | NOT STARTED | Facebook (Buy Nothing groups), NextDoor | Post listings visible only within a social group |
| Barcode/ISBN lookup | P1 | NOT STARTED | Mercari, OfferUp | Scan barcode to auto-fill product details |

## Recommended Features to Build (Beyond MVP)

### Phase 2 Additions

1. **QR code meetup confirmation** - Generate unique QR codes for buyer-seller meetups. Both parties scan to confirm the exchange happened. Builds trust and creates a transaction record. Novel feature no competitor offers.

2. **Listing templates** - Save reusable listing templates for common categories. A book seller can save a "Used Book" template with pre-filled condition, description boilerplate, and category. Reduces listing friction for power sellers.

3. **Barcode/ISBN lookup** - Scan a barcode to auto-fill product title, description, and suggested price. Use Open Library API for books (ISBN), generic UPC databases for other products. Reduces listing creation time from minutes to seconds.

4. **Social shopping feed** - A "Following" tab that shows recent listings from sellers the user follows. Integrates with the existing social follow system. Good for collectors who follow specific sellers.

### Phase 3 Additions

5. **Cross-module listing** - A "Sell this" button in MyBooks, MyCloset, MyGarden (plants), and other relevant modules. Auto-populates a marketplace listing with data from the source module (book title, clothing size, plant type). Unique to the MyLife ecosystem.

6. **Vehicle-specific fields** - Extended listing fields for the Vehicles category: make, model, year, mileage, transmission, fuel type. Optional VIN lookup for vehicle history. Important for a competitive general marketplace.

7. **In-app payment processing** - Stripe Connect integration for optional in-app payments. Enables buyer protection (escrow until delivery confirmed). Seller payouts via Stripe. Only activate if there's user demand.

8. **Shipping support** - Generate shipping labels via carrier APIs. Calculate shipping costs. Track delivery. Enables non-local sales. Only pursue if payment processing is in place.

9. **Group marketplaces** - Scoped marketplaces within social groups. A "SF Buy Nothing" group can have its own marketplace visible only to members. Leverages existing `social_groups` and `social_group_members` tables.

10. **AI-powered listing assistance** - Claude API integration for: auto-suggest title from photos, generate compelling descriptions, suggest fair pricing based on condition and category averages, detect prohibited items in photos.

## MyMarket Differentiators (vs. All Competitors)

1. **Zero fees** - No listing fees, no seller fees, no transaction fees, no subscription beyond MyLife Pro
2. **Zero tracking** - No ad targeting, no behavioral tracking, no data selling
3. **EXIF stripping** - All photo metadata removed on upload (no competitor does this)
4. **Approximate location only** - Neighborhood-level, never exact address
5. **Integrated reputation** - Seller profiles backed by cross-module social profiles (a seller with 100 workout sessions and 50 books read is a real person)
6. **Cross-module listing** - Sell items directly from other MyLife modules (unique to ecosystem)
7. **No algorithmic manipulation** - Chronological + relevance sorting only, no "pay to play"
8. **Community moderation** - Report threshold auto-flagging, no centralized content police
