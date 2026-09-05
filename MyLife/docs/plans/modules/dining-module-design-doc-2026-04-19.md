# MyLife Dining Module — Design Doc & Resy Evaluation
**Author:** Claude (analyst)
**Date:** 2026-04-19
**Status:** Design proposal, ready for founder review
**Module ID candidate:** `dining` (table prefix `dn_`)
**Module count after addition:** 31 modules total

---

## 1. Executive Summary

This document evaluates whether and how MyLife should add restaurant-related functionality, often shorthanded as "add Resy." The conclusion is:

- **Do not build a reservation marketplace.** Competing with Resy/OpenTable/Tock/SevenRooms on the transaction layer would cost $30M+ over 3 years, requires a sales team and field operations MyLife is structurally incompatible with, and would force the company to break its manifesto promises about data extraction. Three of the four major players are now owned by Amex, DoorDash, or Booking Holdings. This market is closed to new entrants.
- **Do build a privacy-first Dining module** that captures the *user's relationship to restaurants* — wishlist, visit log, dish tracking, photo journal, cross-module integration with recipes/nutrition/budget/RSVP — and deep-links out to whichever reservation platform the user prefers (Resy, OpenTable, Tock, the restaurant's website).
- **Strategic positioning:** Resy and OpenTable do not, and structurally cannot, build this. Their business model depends on the diner being a transaction surface, not a person with a memory.

---

## 2. Why "Add Resy" Is the Wrong Framing

When people propose adding Resy-equivalent functionality, they usually conflate two completely different products. The conflation is the cost.

### 2.1 Resy is two products

| Product | Who pays | What it does | Where the value is captured |
|---------|----------|--------------|----------------------------|
| **Resy consumer app** | Free | Discovery, booking, waitlist | Acquisition funnel for the SaaS product and Amex card |
| **Resy OS** | Restaurants ($249-899/mo) | Reservation, table, guest, payment, marketing management | $90M+ ARR, the actual business |

Building "Resy" without the SaaS product is like building "Stripe" without merchant accounts. Building the SaaS product is a different company entirely.

### 2.2 The seven hard reasons reservation marketplaces are an expensive mistake

1. **Two-sided cold-start problem.** No diners without restaurants; no restaurants without diners. Resy struggled with this for 5 years until Amex acquired them in 2019 and subsidized the consumer side via cardholder benefits.
2. **Sales team requirement.** Restaurants are sold to in person. Field reps demo iPad hardware, integrate POS, train staff. Minimum credible motion: 10-15 reps in 5 cities = $4-6M/yr in payroll alone.
3. **Hardware and POS integrations.** iPad-based reservation hardware, Toast/Square/Aloha/Micros integrations, payment terminals. Capex + integration engineering: $2-3M one-time.
4. **PCI DSS Level 1 compliance.** Required to hold credit cards for no-show penalties and prix-fixe deposits. Annual audit cost: $50-100K. Sub-merchant onboarding via Stripe Connect: $200K+ engineering.
5. **99.99% uptime SLA.** Restaurants lose $10K+/hour during dinner service if reservations are down. Requires multi-region failover, on-call SRE rotation, incident response. Not compatible with a small team.
6. **Geographic density.** Each metro requires 200-500 restaurants signed up before consumer launch is viable. Top-25 US metros = 5,000-12,500 restaurants minimum. Years of sales work.
7. **Mission incompatibility.** Reservation marketplaces monetize the data — guest profiles, spend patterns, no-show rates — by selling it back to restaurants and (in Resy's case) using it for credit-card cross-sell and underwriting. This is the exact data-extraction model the MyLife manifesto promises users we will never build.

### 2.3 Cost summary if MyLife pursued the reservation-marketplace path

| Year | Sales | Hardware | POS integ | PCI/fraud | SRE | Legal | **Total** |
|------|-------|----------|-----------|-----------|-----|-------|-----------|
| 1 | $4.0M | $1.5M | $1.5M | $1.0M | $0.5M | $0.5M | **$9.0M** |
| 2 | $6.0M | $2.0M | $1.0M | $1.5M | $1.0M | $0.5M | **$12.0M** |
| 3 | $9.0M | $3.0M | $1.0M | $2.0M | $1.5M | $0.5M | **$17.0M** |
| **3yr** | | | | | | | **$38M** |

To be merely competitive in 5 US cities. With three $1B+ funded incumbents owned by Amex, DoorDash, and Booking. The capital does not exist for this and it would not work even if it did.

---

## 3. Resy Business Evaluation

### 3.1 Ownership and strategic role

Resy was acquired by American Express in May 2019 for an undisclosed amount (estimated $200M+). Resy is operated as a wholly-owned subsidiary and serves three strategic functions for Amex:

1. **Cardholder acquisition.** Resy benefits ($400/yr Resy credit on Platinum, $100 on Gold) are pitched as differentiating Platinum from competing premium cards.
2. **Spend driver.** Amex Card Members make 3.8x more reservations on Resy than non-Amex users. Each reservation drives card swipe at the restaurant.
3. **Data flywheel.** Reservation behavior is integrated into Amex's customer underwriting and cross-sell models.

In late 2024, Amex acquired **Tock** (the prix-fixe reservation platform) for $400M and announced in September 2025 that Tock is being merged into Resy, creating a single 25,000+ venue platform.

### 3.2 Financial profile (estimated)

- Restaurant SaaS revenue (Resy + Tock combined): est **$90M** ARR
- Restaurants: 25,000+ post-merger
- Diners: not disclosed; estimated 10-15M monthly active users
- Profitability: structurally subsidized by Amex; Resy as a standalone business is likely not profitable
- Acquisition cost (Resy + Tock): **~$600M** to American Express

### 3.3 Competitive landscape (consolidating fast)

| Company | Restaurants | Market share | Owner | Acq value |
|---------|-------------|--------------|-------|-----------|
| OpenTable | 22,437 | 32% | Booking Holdings | $2.6B (2014) |
| Resy + Tock | 25,000+ | ~50% | American Express | ~$600M (2019 + 2024) |
| SevenRooms | 5,102 | 7% | DoorDash | $1.2B (June 2025) |
| Yelp Reservations | smaller | <5% | Yelp | n/a |
| TheFork | EU-focused | EU leader | TripAdvisor | n/a |

The market consolidated dramatically in 2024-2025. **Three of four leaders are now owned by hyperscale parents pursuing strategic synergy plays** (card spend, delivery, travel bundles). Pure-play entrants have no path.

### 3.4 Full feature inventory

#### Consumer-side (diner-facing, free)

| Category | Feature |
|----------|---------|
| Discovery | Search by city/cuisine/neighborhood/price |
| | Top Rated lists |
| | New on Resy |
| | Book Tonight |
| | Editorial blog |
| | Map view |
| | Personalized recommendations |
| Booking | Real-time availability search |
| | One-tap booking |
| | Party size, date, time selection |
| | Special occasion notes |
| | Dietary restriction notes |
| | Pre-payment / deposit (Tock specialty) |
| Waitlist | "Notify" — alert when table opens |
| | "Priority Notify" — Amex perk, queue jump |
| | Mobile Waitlist — remote walk-in queue |
| Hit List | Wishlist of restaurants |
| | Notifications on new availability |
| | Notifications on reopening |
| Reservations | Calendar of upcoming bookings |
| | Apple Wallet / Google Pay integration |
| | Cancellation management |
| | Confirmation emails and SMS |
| | Check-in reminders |
| | Past-reservation history |
| Social | Share reservation with friends |
| | Group bookings |
| | Direct messaging with restaurants |
| Premium (Amex) | Global Dining Access — exclusive tables |
| | Platinum Nights — special events |
| | Resy dining credits ($400 Plat, $100 Gold) |
| Misc | Gift cards |
| | Receipts and history |
| | Reviews and ratings (limited) |

#### Restaurant-side (SaaS product, paid)

| Category | Feature |
|----------|---------|
| Reservation mgmt | Calendar / book |
| | Table & server assignment |
| | Pacing controls |
| Floor plan | Visual table layout |
| | Drag-and-drop seating |
| Waitlist | Walk-in waitlist |
| | SMS notifications |
| | Wait time estimates |
| Guest mgmt | Profiles (allergies, preferences, spend, no-show rate) |
| | VIP tagging |
| | Birthday/anniversary tracking |
| | CRM integration |
| Marketing | Email and SMS campaigns |
| | Promotional events |
| Operations | Pre-shift reports |
| | POS integrations (Toast, Square, Aloha, Micros) |
| | Daily summaries |
| | Server tip-out reporting |
| Payments | Stripe-powered processing |
| | Deposits |
| | No-show charges |
| | Pre-payment (Tock) |
| Web presence | resy.com restaurant page |
| | Embeddable booking widget |
| | SEO-optimized profile |
| Analytics | Cover trends, source attribution, performance |

---

## 4. The Wedge — What Resy Cannot and Will Not Build

This is the strategic insight. Resy is structurally limited to **the transaction**. They optimize for converting a diner from "thinking about dinner" to "booked at our restaurant" because that is what their restaurant customers pay them for.

What Resy ignores:
- The user's **dining identity** — what they ordered, who they were with, what they thought of it, the photo of the dish
- Their **dining wishlist** — restaurants they want to try someday but aren't booking right now
- Their **dining history as personal record** — a journal of meals as life events, like a journal of trips
- The **cross-domain dining context** — how this dinner connects to the recipe they cooked last week, the budget category for dining out, the friend they invited, the wine they want to remember, the trip they were on
- **Dining away from Resy restaurants** — the 90%+ of restaurants in any city that aren't on Resy at all (Resy has only 10K US restaurants; the US has ~750K restaurants total)
- **Dining at home** (already in MyLife's Recipes module)

These are user needs Resy cannot serve because they aren't transactional and they aren't restaurant-monetizable. **They are precisely the territory MyLife should own.**

The Dining module's positioning sentence:

> *Resy is where you book a table. MyLife's Dining is where you remember the meal.*

---

## 5. Module Design Specification

### 5.1 Module identity

| Attribute | Value |
|-----------|-------|
| Module ID | `dining` |
| Display name | MyDining (working name; alternatives: Plates, Table, Menu) |
| Table prefix | `dn_` |
| Storage type | SQLite (local-first) |
| Tier | Pro (premium) |
| Mobile | Yes |
| Web | Yes |
| Cloud-backed components | None at launch (everything local) |
| Schema version target | 1.0 |
| Estimated ship sequence | P0-P6 phases over 4-6 months |

### 5.2 Data model

```
dn_restaurants
  id, name, address, city, neighborhood, lat, lng,
  cuisines (json array), price_tier (1-4), website_url,
  resy_url, opentable_url, tock_url, yelp_url, instagram_handle,
  notes_md, is_wishlist, is_visited, first_visited_at,
  last_visited_at, visit_count, average_rating, photo_id,
  created_at, updated_at

dn_visits
  id, restaurant_id, visited_at, party_size, occasion,
  reservation_platform, reservation_confirmation_code,
  reservation_id (-> dn_reservations), overall_rating (1-5),
  vibe_rating, food_rating, service_rating, notes_md,
  total_cost_cents, who_paid, weather, created_at, updated_at

dn_dishes
  id, visit_id, name, description_md, price_cents, course,
  rating (1-5), would_order_again (bool), photo_id, notes_md,
  recipe_id (-> @mylife/recipes), allergens (json), created_at

dn_wines  (separate because wines have their own schema)
  id, visit_id, producer, name, vintage, region, varietal,
  rating (1-5), bottle_price_cents, glass_price_cents,
  pairing_notes_md, would_order_again, photo_id, created_at

dn_companions
  id, visit_id, person_id (nullable; -> @mylife/contacts if exists),
  display_name, notes

dn_reservations
  id, restaurant_id, party_size, reservation_at, duration_minutes,
  source (resy|opentable|tock|yelp|website|phone|walkin|manual),
  external_id, confirmation_code, status (pending|confirmed|seated|completed|cancelled|no_show),
  deposit_cents, special_requests, calendar_event_id, created_at

dn_watchlist
  id, restaurant_id, target_date_min, target_date_max,
  party_size, last_checked_at, last_available_at, notify_enabled,
  active (bool), created_at

dn_photos
  id, visit_id, dish_id, kind (dish|interior|menu|receipt|company|other),
  local_uri, caption, taken_at, exif_lat, exif_lng

dn_tags
  id, name, color, kind (cuisine|vibe|occasion|custom)

dn_restaurant_tags  (m2m)
  restaurant_id, tag_id

dn_imports
  id, source (resy_email|opentable_email|tock_email|apple_maps_export|csv|manual),
  raw_payload, parsed_payload, status, error, created_at

dn_settings
  user_id, default_party_size, default_city, miles_or_km,
  show_prices, default_currency, calendar_sync_enabled,
  calendar_id, photo_quality, allergen_warnings,
  share_with_friends_default
```

### 5.3 Phase plan

#### P0 — Foundation (Weeks 1-2)
- Module package scaffold under `modules/dining/`
- Database schema + migrations
- Module definition wired into module-registry
- Hub icon and color (warm brown #8B6F47 or burgundy #8B3A3A)
- Empty-state screens (mobile + web)
- Settings screen
- Cool Obsidian design tokens applied

#### P1 — Restaurant Manager (Weeks 3-5)
- Add restaurant flow (manual entry + paste-URL parsing)
- Restaurant detail screen
- Restaurant list / grid views
- Search and filter by cuisine, neighborhood, price, tag
- Map view (mobile) using existing Mapbox setup from Trails
- Edit / delete / merge duplicates
- Tag management

#### P2 — Visit Log + Photo Journal (Weeks 6-8)
- Log a visit flow (date, party, occasion, ratings, notes)
- Photo capture and association
- Photo gallery per restaurant
- Visit detail screen
- Visit history (chronological + per-restaurant)
- Quick-add visit from restaurant detail

#### P3 — Dish Tracking (Weeks 9-10)
- Add dish to visit
- Dish detail with photo, rating, notes
- "Would order again" flag and filter
- Dish history per restaurant ("things I've had at Carbone")
- All-time best dishes view
- Allergen flagging

#### P4 — Wishlist + Watchlist (Weeks 11-12)
- Wishlist toggle on restaurant
- Wishlist screen (sortable by recency, neighborhood, last attempted)
- Watchlist (party size + date range + notify settings)
- Local notifications when watchlist criteria might match (initially based on user check-ins, later via optional public scraping)
- "Restaurants I keep meaning to try" weekly digest

#### P5 — Reservation Tracking + Deep Linking (Weeks 13-15)
- Manual reservation entry
- Reservation calendar (linked to system Calendar via existing iOS/Android APIs)
- Deep links: `resy://`, `opentable://`, `yelp://`, web fallback for Tock and restaurant sites
- Email parser for confirmation emails (on-device parsing of common Resy/OpenTable/Tock email formats)
- Reservation reminders (90 min, 1 day, 1 week before)
- Cancellation tracking and no-show counter

#### P6 — Cross-Module Integration (Weeks 16-18)
- Link visit → recipes module ("recreate this dish at home")
- Link visit → nutrition module (log meal nutrition estimate)
- Link visit → budget module (auto-categorize as Dining Out)
- Link visit → RSVP module (group reservation as event)
- Link visit → trails/travel (restaurants visited on trips)
- Link visit → pets (pet-friendly tag)
- Link wishlist → mood module (restaurants for celebration days)

#### P7 — Advanced (Weeks 19-22, optional)
- Wine cellar / sommelier mode
- Year-in-review (best meals, most-visited, dish of the year)
- Restaurant recommendations to friends (via existing forums/share infra)
- CSV export and import
- Yelp / Google Maps import
- Multi-currency support for travelers
- Restaurant heatmap by city visited

### 5.4 What the module explicitly does NOT do

To stay within mission and within scope:

1. **Does not host a restaurant directory or marketplace.** No paid placement, no editorial commerce, no advertising.
2. **Does not process payments.** Zero PCI compliance scope.
3. **Does not offer real-time availability beyond deep-linking out.** No scraping at launch (P4 watchlist initially relies on user check-ins; optional public-page polling is a P7+ consideration with strong rate limiting and a fallback to manual when blocked).
4. **Does not facilitate the booking transaction itself.** When the user taps "Book," they are deep-linked to Resy/OpenTable/Tock/restaurant website. The booking happens there. We never see card data.
5. **Does not aggregate reviews.** No public review scraping. User's own private notes only.
6. **Does not sync to a central restaurant database.** Each user maintains their own private restaurant list. Optional opt-in community-shared restaurant metadata is a far-future consideration.
7. **Does not advertise restaurants to users.** No "promoted dining" surface. Discovery is local-first based on user history and tags.

### 5.5 Privacy model

Consistent with the rest of MyLife:

- All data stored in `dn_` prefixed tables in the user's local SQLite database
- Photos stored in encrypted local storage (consistent with Journal module pattern)
- No analytics, no telemetry, no behavioral tracking
- Email parser runs entirely on-device using local regex/heuristics (never sends emails to a server)
- Deep links open external apps; we cannot see what the user does there
- Optional Calendar sync uses native EventKit (iOS) / CalendarContract (Android) APIs
- Optional photo location data (EXIF) can be stripped on import per user preference

### 5.6 External dependencies

| Dependency | Purpose | Risk | Mitigation |
|------------|---------|------|------------|
| Mapbox | Map view of restaurants | Cost scales with usage | Already in Trails module; cache aggressively |
| Apple/Google Maps URL schemes | Open native maps for directions | Low | Standard URL schemes |
| Resy / OpenTable / Tock URL schemes | Deep link to booking apps | Schemes could change | Fall back to web URL |
| EventKit (iOS) / CalendarContract (Android) | Calendar sync | Low | Native APIs, stable |
| Native camera | Photo capture | Low | Standard |
| EXIF parsing library | Photo metadata | Low | Many open-source options |

No external API account is required for launch. **Zero per-user infrastructure cost** consistent with MyLife's local-first architecture.

---

## 6. Cross-Module Integration Map

The Dining module's strategic value is amplified by how it connects to the rest of the suite. Resy cannot do any of this.

```
                            ┌─────────────┐
                            │  Recipes    │ "Recreate Carbone's spicy rigatoni at home"
                            └──────┬──────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
   ┌────────▼─────────┐   ┌────────▼────────┐   ┌────────▼────────┐
   │  Nutrition       │   │   Budget        │   │  RSVP           │
   │  "Log dinner     │   │  "Dining Out:   │   │  "Group dinner  │
   │  carbs+protein"  │   │  $340 this mo"  │   │  for 6 people"  │
   └────────┬─────────┘   └────────┬────────┘   └────────┬────────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │     DINING        │
                         │   (visits, dishes,│
                         │  wishlist, photos)│
                         └─────────┬─────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
   ┌────────▼─────────┐   ┌────────▼────────┐   ┌────────▼────────┐
   │  Trails          │   │  Mood           │   │  Pets           │
   │  "Restaurants on │   │  "Best meals    │   │  "Pet-friendly  │
   │  the Tahoe trip" │   │  on great days" │   │  patios"        │
   └──────────────────┘   └─────────────────┘   └─────────────────┘

                         ┌──────────────────┐
                         │  Mail (parser)   │ Auto-import reservations
                         └──────────────────┘
                         ┌──────────────────┐
                         │  Calendar (sync) │ Reservations on phone calendar
                         └──────────────────┘
```

This integration map is the **moat**. None of it is possible inside a single-vertical app like Resy because Resy doesn't have the other 30 modules.

---

## 7. Effort Estimate

| Phase | Engineering effort | Design | QA |
|-------|-------------------|--------|----|
| P0 Foundation | 1.5 weeks | 0.5 wk | 0.5 wk |
| P1 Restaurant Manager | 2.5 weeks | 1 wk | 1 wk |
| P2 Visit Log + Photos | 2.5 weeks | 1 wk | 1 wk |
| P3 Dish Tracking | 1.5 weeks | 0.5 wk | 0.5 wk |
| P4 Wishlist + Watchlist | 2 weeks | 1 wk | 0.5 wk |
| P5 Reservations + Deep Links | 3 weeks | 1 wk | 1 wk |
| P6 Cross-Module Integration | 2.5 weeks | 0.5 wk | 1 wk |
| P7 Advanced (optional) | 4 weeks | 1.5 wk | 1 wk |
| **Total to ship P0-P6** | **15.5 weeks** | **5.5 wk** | **5.5 wk** |
| **With P7** | **19.5 weeks** | **7 wk** | **6.5 wk** |

At the current solo-founder + AI rate of execution demonstrated by the existing 30 modules, P0-P6 should ship in approximately **3-4 calendar months** with normal AI-amplified velocity. P7 adds another month if pursued.

---

## 8. Risks and Considerations

### 8.1 Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Deep link schemes change (Resy, OpenTable) | Low | Medium | Always fall back to public web URL |
| Email parser breaks when Resy/OpenTable change templates | Medium | Medium | Versioned parsers; monitor and update; user can always enter manually |
| Apple/Google reject the module for "deep linking to competitors" | Low | Low | Universal links and web URLs are explicitly permitted |
| User photos consume large local storage at scale | Medium | High | Implement smart compression, optional cloud backup at user's choice, gallery cleanup tools |
| Restaurant database accuracy degrades (closed restaurants) | Low | Medium | User-driven; we are not maintaining a directory |
| Scraping availability for watchlist creates legal exposure | High | Low (only relevant in P7+) | Default to user check-ins only; if scraping is added, respect robots.txt and rate-limit aggressively; design for graceful degradation when blocked |
| Module is perceived as inferior to Resy on "find a table" | High | High | Position clearly: this is a *companion to* Resy, not a *replacement for* it. Make deep-link booking flow excellent. |

### 8.2 Open questions for founder decision

1. **Module name.** Working name "MyDining." Alternatives: "MyTable," "Plates," "Menu," "Palate." Name affects icon/branding.
2. **Free vs Pro tier.** Recommend Pro (one of the 25 paid modules), consistent with most lifestyle modules. Free tier of 5 modules already set.
3. **Wine module split.** Should wines be a sub-feature of Dining, a tag inside dishes, or a separate "Cellar" module entirely? Recommend: in-Dining for now; spin out only if usage warrants.
4. **First-launch geo focus.** Module is geo-agnostic but P5 deep-link integrations should prioritize Resy/OpenTable/Tock (US/UK), TheFork (EU), Quandoo (Germany), Dimmi (Australia). Recommend US-first for launch.
5. **Photo cloud backup.** Local-only is consistent with Journal. Should there be optional cloud backup as an add-on (potential future revenue stream)? Recommend: not at launch, evaluate at Y2.
6. **Watchlist strategy.** Pure user-check-in is cheapest and safest. Public-page polling is more useful but has legal/cost considerations. Recommend: ship pure check-in at P4; revisit polling at P7 with proper safeguards.

### 8.3 What this does to the broader MyLife strategy

- **Adds 1 module** to the 30-module bundle, bringing total to **31**.
- **Strengthens the "$12/yr replaces $700/yr stack" narrative** — Resy is free but the dining-tracking apps users currently use (Late July, Beli, EatMore) charge $30-60/yr individually.
- **Reinforces the cross-module flywheel** more visibly than almost any other module addition because dining touches recipes, nutrition, budget, RSVP, mood, trails, and pets simultaneously.
- **Resonates with target demographic.** Privacy-conscious knowledge workers in major metros are heavy Resy users and exactly the audience MyLife is built for.
- **Provides natural launch press hook.** "Privacy-first Resy companion" is a one-line story that journalists at The Verge, Eater, and 404 Media will pick up.

---

## 9. Recommended Decision

**Build the Dining module per the P0-P6 phase plan above. Defer P7 until P0-P6 ships and shows usage.**

Do **not** under any circumstances pursue building reservation-marketplace functionality. The transaction layer is Resy's, OpenTable's, Tock's, and SevenRooms' to fight over. The user's dining identity is ours to define.

**Estimated time to ship MVP (P0-P3):** 8 weeks.
**Estimated time to ship full launch (P0-P6):** 16 weeks.
**Cost:** within existing development budget; no new external services or licenses required.

---

## 10. References

- [Resy product overview](https://resy.com/)
- [Resy/Tock merger announcement](https://www.restaurantbusinessonline.com/technology/reservation-services-resy-tock-are-merging) (Sept 2025)
- [DoorDash acquires SevenRooms for $1.2B](https://www.cnbc.com/2026/02/25/doordash-resy-opentable-restaurant-reservation-wars.html) (June 2025)
- [American Express Resy benefits](https://www.americanexpress.com/en-us/credit-cards/credit-intel/resy-credit/)
- [OpenTable market share data](https://6sense.com/tech/restaurant-reservation-software/opentable-market-share)
- [Resy OS for restaurants](https://resy.com/join/)
- Existing MyLife module patterns: `modules/recipes/`, `modules/nutrition/`, `modules/journal/`, `modules/trails/`
