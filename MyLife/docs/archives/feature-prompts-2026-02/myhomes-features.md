# MyHomes Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. MyHomes uses a **cloud backend** (Drizzle ORM + tRPC + PostgreSQL) rather than local SQLite, and its hub module lives at `modules/homes/`.

**MyHomes** is a real estate and home search app. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyHomes/`, a Turborepo monorepo with `apps/web/` (Next.js 15), `apps/mobile/` (Expo), `apps/api/` (Fastify + tRPC), `packages/shared/` (types), `packages/ui/` (components). Approximately 60 files, mostly scaffolding. Authentication uses Clerk.

**Current state:** Early development. What exists: basic web pages (landing, about, discover, messages, profile, sell), mobile tab navigation shell, Drizzle ORM schema with PostgreSQL, Clerk auth integration, UI package with components. What does NOT exist: listing CRUD, property search, maps, messaging, neighborhood data, or any core real estate functionality. This is largely a ground-up feature build on existing scaffolding.

**MyHomes is standalone** (no absorbed apps). It is the home buying/selling platform within the MyLife suite.

**What needs to be built (2 feature sets):**

### Feature Set 1: Listing and Search (Core MVP)

The foundation that makes MyHomes usable. Users need to create listings, search for homes, and view them on a map.

**Features:**
- Listing CRUD: create a property listing with address, price, bedrooms/bathrooms, square footage, lot size, year built, property type, description, and up to 20 photos
- "Home Story" narrative: a free-form text field where sellers describe what makes their home special (beyond facts and figures), displayed prominently on the listing
- Map-based search: interactive map (MapLibre on web, Mapbox on mobile) showing listings as pins; pan and zoom to search; cluster pins at high zoom levels
- Search filters: price range, bedrooms, bathrooms, square footage, property type, distance from a point
- Listing detail page: photo gallery (swipeable), key facts grid, Home Story section, seller profile, and contact button
- Saved searches: save filter combinations and get notified when new listings match

### Feature Set 2: Buyer Experience and Messaging

Features that enable the buyer journey from discovery to first contact.

**Features:**
- Buyer profile: preferences (location, budget, move-in timeline, must-haves, deal-breakers) used for personalized sorting
- "Resonance Engine": a private scoring system that ranks listings by how well they match the buyer's stated preferences plus implicit signals (time spent on listing, photos viewed, saved vs. passed), all computed on-device with no data leaving the app
- First-contact flow: structured message template for initial buyer-to-seller contact (prevents spam, ensures key info is exchanged)
- Direct messaging: real-time chat between buyer and seller using Stream Chat SDK or similar
- Neighborhood intelligence: walkability score, nearby schools, commute time estimates, and local amenities overlaid on the map (sourced from open data APIs)
- Favorites and comparison: save listings to favorites, compare up to 4 side-by-side in a comparison table

---

## Acceptance Criteria

### Feature Set 1: Listing and Search

1. User taps "List My Home" -> fills in address, price ($650,000), 3 bed / 2 bath, 1,800 sqft, uploads 5 photos, writes a Home Story ("We raised our kids in this kitchen...") -> listing goes live and appears on the map as a pin at the correct address
2. User opens the map and pans to San Francisco -> sees clustered pins for available listings; zooms in -> clusters break into individual pins; taps a pin -> sees a preview card with photo, price, and bed/bath count; taps the card -> navigates to the full listing detail page
3. User opens filters and sets "2+ bedrooms, under $800K, within 5 miles of downtown" -> the map and list view update to show only matching listings; user taps "Save Search" -> the filter set is saved; when a new listing matches, user receives a notification
4. User views a listing detail page -> sees a swipeable photo gallery, key facts (price, beds, baths, sqft, year built), the Home Story narrative in a styled card, seller profile with avatar and name, and a "Contact Seller" button

### Feature Set 2: Buyer Experience and Messaging

5. User fills out a buyer profile (budget: $500K-$700K, must-have: garage, deal-breaker: no HOA, move-in: 3 months) -> listing results re-sort with the best matches first; a "Match Score" badge (e.g., "92% match") appears on each listing card
6. User taps "Contact Seller" on a listing -> sees a structured first-contact form with pre-filled fields (budget range, timeline, pre-approval status, message) -> submits -> seller receives the message in their inbox with the buyer's profile summary
7. User opens Messages -> sees conversation threads with sellers; taps a thread -> real-time chat with read receipts and typing indicators
8. User browses a listing and taps "Neighborhood" -> sees a map overlay with walkability score, nearby schools with ratings, estimated commute time to their workplace, and local amenities (grocery, parks, transit)

---

## Constraint Architecture

**Musts:**
- Backend uses Drizzle ORM with PostgreSQL (not SQLite) via the existing Fastify + tRPC API at `MyHomes/apps/api/`
- Authentication via Clerk (existing integration)
- Map uses MapLibre (web) / Mapbox (mobile) consistent with MySurf's map infrastructure
- Photo storage via a cloud object store (Supabase Storage, Cloudflare R2, or S3)
- Listing addresses must be geocoded to lat/lng for map display
- Resonance Engine scoring runs entirely on-device (no server-side preference data)

**Must-nots:**
- Do not use Zillow, Realtor.com, or MLS data feeds (this is a direct-by-owner platform, not a broker aggregator)
- Do not store buyer preference data on the server (privacy-first: Resonance Engine is local only)
- Do not modify `packages/module-registry/` or other modules
- Do not add payment processing in MVP (no transaction fees or premium listing features yet)
- Do not require buyer accounts to browse listings (auth required only for saving, messaging, and listing)

**Preferences:**
- Geocoding via a free tier API (Nominatim / OpenStreetMap) rather than Google Maps Platform
- Neighborhood data from open sources: Walk Score API (free tier), GreatSchools API, Census data
- Stream Chat SDK for messaging (managed service, real-time, good React/React Native support)
- Photo gallery using a lightweight carousel (react-native-reanimated on mobile, CSS scroll-snap on web)
- Listing search should use PostGIS `ST_DWithin` for geographic proximity queries

**Escalation triggers:**
- If Stream Chat SDK pricing is prohibitive for MVP, fall back to a simple Supabase Realtime channel for messaging
- If geocoding rate limits block development, bundle a California address-to-coordinates dataset for testing
- If Walk Score API requires a paid plan, show "coming soon" for neighborhood intelligence and defer

---

## Subtask Decomposition

**Subtask 1: Listing Schema and CRUD (90 min)**
Define Drizzle schema for listings (address, price, beds, baths, sqft, lot_size, year_built, type, description, home_story, photos, seller_id, status, lat, lng). Build tRPC procedures for create, read, update, delete, list with pagination. Implement geocoding on create/update.

**Subtask 2: Map Search and Filters (90 min)**
Build the map view with listing pins using MapLibre/Mapbox. Implement pin clustering at high density. Build filter UI (price range slider, bed/bath selectors, property type, radius). Wire filters to PostGIS spatial queries via tRPC.

**Subtask 3: Listing Detail and Photo Gallery (60 min)**
Build the listing detail page with swipeable photo gallery, key facts grid, Home Story card, and seller profile section. Handle photo upload to cloud storage with URL references in the database.

**Subtask 4: Buyer Profile and Resonance Engine (90 min)**
Build buyer profile form (budget, must-haves, deal-breakers, timeline). Implement the on-device Resonance Engine: score each listing against preferences (weighted match on budget, features, location) plus implicit signals (view duration, save/pass). Sort results by resonance score.

**Subtask 5: Messaging System (90 min)**
Integrate Stream Chat SDK (or Supabase Realtime fallback). Build first-contact flow with structured message template. Build conversation list and chat UI with real-time updates. Connect buyer-seller threads to specific listings.

**Subtask 6: Neighborhood Intelligence (60 min)**
Integrate Walk Score API, GreatSchools API, and local amenity data. Build neighborhood overlay on the map view and a "Neighborhood" section on listing detail. Calculate commute time estimates using a routing API or straight-line distance approximation.

---

## Evaluation Design

1. **Listing CRUD:** Create a listing with address "123 Main St, San Francisco, CA" -> verify lat/lng are populated via geocoding; query `getListings({bounds})` with SF bounds -> listing appears in results
2. **Map search:** Insert 50 test listings across California -> load map at state zoom -> see clustered pins; zoom to SF -> clusters break apart; apply filter "3+ bed, < $800K" -> only matching pins remain
3. **Resonance scoring:** Set buyer budget to $500K-$700K with must-have "garage" -> listing at $600K with garage scores higher than listing at $600K without garage; listing at $900K scores near 0 regardless of features
4. **Messaging:** Buyer sends first contact to seller -> seller receives message in inbox; seller replies -> buyer sees reply in real-time without page refresh
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
