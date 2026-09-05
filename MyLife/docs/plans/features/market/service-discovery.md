# Feature Spec: Market Service Discovery

## Metadata
- **Module:** market
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 1 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** UI screens (market), Cloud client functions (market)
- **Blocks:** None

## Business Context

### Why This Feature Exists
MyMarket already supports `service_offer` and `service_request` listing types, with `fulfillment_type` options (onsite, remote, pickup, delivery, shipping) and `service_radius_miles`. The data model is there, but there's no specialized UI or discovery flow for services. Services are fundamentally different from goods: they're recurring, location-bounded, require availability matching, and benefit from portfolio/gallery presentation. A plumber listing their services needs different UI than someone selling a couch.

This feature turns MyMarket from a goods-only marketplace into a services marketplace, competing with TaskRabbit, Thumbtack, and the services side of NextDoor, all without fees.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| TaskRabbit | Yes | No (but 15% fee) | Task-based booking, profiles, reviews, background checks. Acquired by IKEA. |
| Thumbtack | Yes | No (pay-per-lead) | Contractor profiles, instant match, cost estimates, reviews. |
| NextDoor | Partial | No | "Find a Pro" directory, recommendations from neighbors, basic profiles. |
| Facebook Marketplace | Partial | No | Services category exists but minimal differentiation from goods UI. |
| Craigslist | Yes | No (some fees) | "Services" section, list-based, no profiles or booking. |
| Yelp | Yes | No (ads for visibility) | Business profiles, reviews, photos, quotes. Focus on established businesses. |

### Target User
Local service providers (tutors, handypeople, cleaners, pet sitters, photographers) who want to advertise their services without platform fees. Community members looking for trusted local services within their area. Replaces the "services" section of Craigslist with a modern, profile-driven experience.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  services/
    discovery.ts             -- Service search, filtering, matching logic
    types.ts                 -- Service-specific Zod schemas
    index.ts                 -- Barrel export
  cloud/
    schema.sql               -- Add mk_service_areas, mk_service_portfolio tables
    client.ts                -- Add service discovery cloud functions
apps/mobile/app/(market)/
  services.tsx               -- Service discovery browsing screen
  service-detail.tsx         -- Service provider detail screen
  create-service-listing.tsx -- Guided service listing creation
apps/web/app/market/
  services/page.tsx          -- Service discovery page
  services/[id]/page.tsx     -- Service provider detail
  services/create/page.tsx   -- Create service listing
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Browse tab
            └── "Services" category (promoted to top-level section)
                 └── Service Discovery Grid ← YOU ARE HERE
       └── Sell tab
            └── "Offer a Service" flow
```

### Data Model

```sql
-- Service provider portfolio items (photos of work, certifications)
CREATE TABLE IF NOT EXISTS mk_service_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'certificate', 'before_after')),
  url TEXT NOT NULL,
  caption TEXT CHECK (char_length(caption) <= 200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service area polygons (more precise than radius)
CREATE TABLE IF NOT EXISTS mk_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  area_name TEXT NOT NULL CHECK (char_length(area_name) <= 100),
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_miles INTEGER NOT NULL CHECK (radius_miles BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service availability slots (optional structured availability)
CREATE TABLE IF NOT EXISTS mk_service_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

New Zod schemas:

```typescript
export const ServicePortfolioItemSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  mediaType: z.enum(['photo', 'certificate', 'before_after']),
  url: z.string().url(),
  caption: z.string().max(200).nullable(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const ServiceAreaSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  areaName: z.string().max(100),
  centerLat: z.number(),
  centerLng: z.number(),
  radiusMiles: z.number().int().min(1).max(100),
  createdAt: z.string().datetime(),
});

export const ServiceAvailabilitySchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  createdAt: z.string().datetime(),
});
```

### Dependencies
- **Internal:** `@mylife/market` (listings with service types, cloud client, types), `@mylife/ui`
- **External:** PostGIS (spatial queries for service area matching)
- **Cross-Module:** `@mylife/social` (service provider profiles linked to social profiles), `@mylife/rsvp` (future: booking integration)

## Functional Requirements

### User Stories
1. As a service seeker, I want to browse local services by category so I can find help nearby.
2. As a service seeker, I want to see a provider's portfolio and reviews so I can evaluate quality.
3. As a service provider, I want to create a service listing with my portfolio and service area.
4. As a service provider, I want to specify my availability so clients know when I'm free.
5. As a service seeker, I want to filter services by availability, distance, and price range.

### Behavior Specification

**Service Discovery (services.tsx):**
1. User navigates to Browse > Services (promoted category section).
2. Screen shows service categories: Tutoring, Repairs, Cleaning, Moving, Pet Care, Photography, Personal Training, Tech Support, Beauty, Other.
3. Each category shows count of active service providers nearby.
4. User selects a category to see providers.
5. Provider cards show: profile photo, name, rating, price range, service radius, availability summary.
6. Filter bar: distance (1-50 miles), price range, availability (day of week), rating minimum.
7. Results sorted by: relevance (distance + rating), nearest, highest rated, newest.

**Service Provider Detail (service-detail.tsx):**
1. Header: provider name, rating, review count, member since, response time.
2. Service description (from listing description field).
3. Portfolio gallery: before/after photos, work samples, certifications.
4. Service area map: visual radius on a map centered on provider's service area.
5. Availability grid: weekly schedule showing available time slots.
6. Price info: hourly rate or flat rate, displayed from listing price.
7. Reviews section: filtered to show only reviews from service clients.
8. Action buttons: "Request Service" (starts conversation with service context), "Save Provider".

**Create Service Listing (create-service-listing.tsx):**
1. Step 1: Service category selection.
2. Step 2: Title, description, pricing (hourly/flat rate, negotiable).
3. Step 3: Portfolio upload (work photos, before/after, certifications).
4. Step 4: Service area (set center point + radius on map, name the area).
5. Step 5: Availability (weekly calendar picker).
6. Step 6: Preview and publish.

### Edge Cases
- Provider with no portfolio photos: show placeholder "No portfolio photos yet"
- Provider outside user's location: show with distance, still accessible
- No services in user's area: "No services found nearby. Try expanding your search radius."
- Service listing without availability set: show "Contact for availability"
- Multiple service areas: provider can serve multiple non-contiguous areas
- Service and goods listings by same user: both appear on their seller profile
- Search matching "plumber" to "Plumbing & Repairs" category: fuzzy category matching

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Services section accessible from Browse tab as a promoted category group
- [ ] **AC-2:** Service categories display provider counts for user's area
- [ ] **AC-3:** Provider cards show photo, name, rating, price, service radius, availability
- [ ] **AC-4:** Service detail screen shows portfolio gallery with before/after photos
- [ ] **AC-5:** Service area displayed as radius on a map
- [ ] **AC-6:** Availability grid shows weekly schedule with time slots
- [ ] **AC-7:** Filter bar filters by distance, price range, availability day, minimum rating
- [ ] **AC-8:** "Request Service" starts a conversation with service listing context
- [ ] **AC-9:** Create service listing flow includes portfolio upload and area/availability setup

### Technical Criteria
- [ ] **TC-1:** Service listings use existing listing_type = 'service_offer' and fulfillment_type fields
- [ ] **TC-2:** Service area queries use PostGIS spatial functions for radius matching
- [ ] **TC-3:** Portfolio items stored in Supabase Storage under `service-portfolio/{listingId}/`
- [ ] **TC-4:** Availability stored as day_of_week + time range records (queryable for day filtering)
- [ ] **TC-5:** Service search results ranked by combined distance + rating score
- [ ] **TC-6:** All new tables use mk_ prefix and have appropriate RLS policies

### Negative Criteria
- [ ] **NC-1:** Must NOT show exact provider address (service area center only, neighborhood level)
- [ ] **NC-2:** Must NOT charge listing fees for service providers
- [ ] **NC-3:** Must NOT require a portfolio to publish a service listing (optional enhancement)
- [ ] **NC-4:** Must NOT mix service listings with goods listings in the main browse grid (separate section)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Service category cards: glass cards with category icon, name, and provider count
- Provider cards: horizontal layout with photo left, info right (different from goods grid)
- Portfolio gallery: horizontal scroll with larger thumbnails (160x160), tappable to full-screen
- Service area map: expo-maps (or MapView) with a radius circle overlay
- Availability grid: 7-column (Mon-Sun) grid with colored time blocks (available=accent, unavailable=gray)
- Module accent: `#14B8A6` for "Request Service" button

### Web (Next.js)
- Services page: category sidebar + provider grid
- Provider detail: two-column (portfolio gallery left, info right)
- Availability: interactive weekly calendar widget
- Service area: embedded map with radius visualization (MapLibre GL)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton provider cards | Initial fetch |
| Empty | "No services found nearby" + expand radius CTA | No results for filter |
| Success | Provider cards grid with filter bar | Data loaded |
| Detail Loading | Skeleton profile + gallery | Opening provider detail |
| Detail Success | Full provider profile with portfolio and availability | Detail data loaded |
| No Portfolio | Provider info without gallery section | Provider has no portfolio items |

## Test Requirements

### Unit Tests
- [ ] Service search: filters by listing_type = 'service_offer'
- [ ] Distance filter: excludes providers outside specified radius
- [ ] Availability filter: matches providers available on selected day
- [ ] Rating filter: excludes providers below minimum rating
- [ ] Result ranking: combined distance + rating score calculation
- [ ] Service area validation: radius between 1-100 miles
- [ ] Availability validation: start_time before end_time

### Integration Tests
- [ ] Full flow: create service listing with portfolio + area + availability -> appears in service discovery
- [ ] Filter flow: set distance 5mi + Tuesday + 4+ stars -> only matching providers shown
- [ ] Request flow: "Request Service" -> conversation created with listing context

### QA Verification Script

1. Open Market module, navigate to Browse tab
2. Verify "Services" section visible as promoted category group -- AC-1
3. Tap a service category (e.g., "Repairs") -- verify provider cards displayed -- AC-3
4. Verify provider counts shown per category -- AC-2
5. Set distance filter to 10 miles -- verify results update -- AC-7
6. Set availability filter to "Monday" -- verify results filter -- AC-7
7. Tap a provider card -- verify detail screen opens
8. Verify portfolio gallery with photos -- AC-4
9. Verify service area map with radius circle -- AC-5
10. Verify availability grid showing weekly schedule -- AC-6
11. Tap "Request Service" -- verify conversation opens -- AC-8
12. Navigate to Sell tab, tap "Offer a Service"
13. Complete service listing creation with portfolio and availability -- AC-9
14. Verify new listing appears in service discovery
15. Verify no exact address shown anywhere -- NC-1
16. Verify services section is separate from goods browse grid -- NC-4

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to services screens, verify all states

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market has service_offer and service_request listing types in the type system, fulfillment_type and service_radius_miles fields, but no specialized UI for service discovery, no portfolio system, no structured availability, and no service area visualization.

### After This Work
Complete service discovery experience: dedicated browsing section, provider profiles with portfolios, service area maps, weekly availability grids, and guided service listing creation.

### Files Changed
- `modules/market/src/services/discovery.ts` -- Service search and ranking logic
- `modules/market/src/services/types.ts` -- ServicePortfolio, ServiceArea, ServiceAvailability schemas
- `modules/market/src/services/index.ts` -- Barrel export
- `modules/market/src/cloud/schema.sql` -- mk_service_portfolio, mk_service_areas, mk_service_availability
- `modules/market/src/cloud/client.ts` -- Service discovery cloud functions
- `modules/market/src/types.ts` -- Export new schemas
- `modules/market/src/index.ts` -- Export services module
- `apps/mobile/app/(market)/services.tsx` -- Service discovery screen
- `apps/mobile/app/(market)/service-detail.tsx` -- Service provider detail
- `apps/mobile/app/(market)/create-service-listing.tsx` -- Guided service listing creation
- `apps/web/app/market/services/page.tsx` -- Service discovery page
- `apps/web/app/market/services/[id]/page.tsx` -- Provider detail
- `apps/web/app/market/services/create/page.tsx` -- Create service listing

### Known Limitations
- No in-app booking/scheduling (conversation-based for MVP)
- No background check integration for service providers
- No automated price quoting or cost estimation
- Portfolio limited to photos and certificates (no video)
- Service areas use simple radius, not custom polygon boundaries

### Context for Next Agent
Service listings use the existing `ListingSchema` with `listingType: 'service_offer'` or `'service_request'`. The `fulfillmentType` and `serviceRadiusMiles` fields on the listing are the basic service parameters. The new tables (portfolio, area, availability) are supplementary data linked via listing_id. Use the existing `cloudSearchListings` function as a base and add service-specific filtering on top.
