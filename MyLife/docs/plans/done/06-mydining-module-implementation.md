# Plan: MyDining Module Implementation

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyDining (new hub module, no standalone)
priority: 06
effort: L
dependencies: ["packages/db", "packages/ui", "packages/module-registry"]
worktree: true
worktree_name: mydining-module
parallel_phases: false
created: 2026-04-19
companion_doc: docs/plans/modules/dining-module-design-doc-2026-04-19.md
```

## Objective

Add a new privacy-first Dining module to the MyLife hub that captures the user's personal
relationship to restaurants — wishlist, visit log, dish tracking, photo journal, watchlist
for hard-to-book restaurants, and reservation tracking — and deep-links out to existing
booking platforms (Resy, OpenTable, Tock, restaurant websites) for the actual booking
transaction. The module is local-first, requires zero per-user infrastructure, and
explicitly does not compete with reservation marketplaces. Cross-module integration with
Recipes, Nutrition, Budget, RSVP, Trails, Mood, and Pets makes the dining log useful in
ways no single-vertical app can match.

This is a hub-only module with no standalone equivalent (consistent with `presence`
module pattern). All work happens inside `modules/dining/`, `apps/mobile/`, and
`apps/web/` simultaneously per hub-only module convention.

## Scope

### Files Affected

**Module package (modules/dining/) — NEW**
- `package.json` — TypeScript-first, RN peer deps for mobile UI components
- `tsconfig.json` — references `@mylife/typescript-config/react.json`
- `src/definition.ts` — ModuleDefinition with id `dining`, prefix `dn_`, tier `pro`
- `src/types.ts` — TypeScript types for restaurants, visits, dishes, wines, photos, etc
- `src/db/schema.ts` — SQLite migrations for `dn_*` tables
- `src/db/crud/restaurants.ts` — restaurant CRUD
- `src/db/crud/visits.ts` — visit + dish CRUD
- `src/db/crud/wines.ts` — wine CRUD
- `src/db/crud/companions.ts` — companion CRUD
- `src/db/crud/reservations.ts` — reservation CRUD
- `src/db/crud/wishlist.ts` — wishlist + watchlist CRUD
- `src/db/crud/photos.ts` — photo metadata CRUD (binary stays in encrypted file storage)
- `src/db/crud/tags.ts` — tag CRUD
- `src/db/crud/imports.ts` — import history CRUD
- `src/db/crud/settings.ts` — module settings CRUD
- `src/engine/deep-links.ts` — Resy/OpenTable/Tock/Yelp/web URL builders + handlers
- `src/engine/email-parser.ts` — on-device parser for Resy/OpenTable/Tock confirmation emails
- `src/engine/restaurant-merge.ts` — duplicate detection and merge logic
- `src/engine/photo-pipeline.ts` — compression, EXIF strip, encrypted storage write
- `src/engine/calendar-sync.ts` — EventKit/CalendarContract reservation sync
- `src/engine/insights.ts` — visit count rollups, dish ratings aggregations, year-in-review
- `src/models/schemas.ts` — Zod schemas for all entities
- `src/ui/index.ts` — web-safe exports (tokens, types, pure logic)
- `src/ui/index.native.ts` — RN-only component exports
- `src/ui/components/RestaurantCard.tsx`
- `src/ui/components/VisitCard.tsx`
- `src/ui/components/DishRow.tsx`
- `src/ui/components/WineRow.tsx`
- `src/ui/components/RatingControl.tsx`
- `src/ui/components/PhotoGallery.tsx`
- `src/ui/components/MapView.tsx` (mobile only; reuses Mapbox setup from Trails)
- `src/ui/tokens.ts` — Cool Obsidian tokens scoped to module accent (#8B6F47 warm-brown OR #8B3A3A burgundy; founder decision)
- `src/__tests__/` — engine + CRUD tests
- `CLAUDE.md` — module documentation

**Mobile app (apps/mobile/app/(dining)/) — NEW route group**
- `_layout.tsx` — module layout wrapper with floating tab bar
- `index.tsx` — Restaurants home (tab 1)
- `wishlist.tsx` — Wishlist + watchlist (tab 2)
- `visits.tsx` — Visit log chronological (tab 3)
- `dishes.tsx` — All-time dish browser (tab 4)
- `restaurant/[id].tsx` — Restaurant detail with visits, dishes, photos
- `restaurant/add.tsx` — Add restaurant flow (manual + paste-URL)
- `restaurant/edit/[id].tsx` — Edit restaurant
- `visit/[id].tsx` — Visit detail
- `visit/log.tsx` — Log new visit flow
- `visit/edit/[id].tsx` — Edit visit
- `dish/[id].tsx` — Dish detail
- `reservation/[id].tsx` — Reservation detail
- `reservation/new.tsx` — Add reservation
- `map.tsx` — Map view of restaurants
- `year-in-review.tsx` — Annual dining summary
- `settings.tsx` — module settings
- `import.tsx` — CSV / Apple Maps import wizard

**Web app (apps/web/app/(modules)/dining/) — NEW route group**
- `page.tsx` — Restaurants home
- `wishlist/page.tsx`
- `visits/page.tsx`
- `dishes/page.tsx`
- `restaurant/[id]/page.tsx`
- `restaurant/add/page.tsx`
- `restaurant/[id]/edit/page.tsx`
- `visit/[id]/page.tsx`
- `visit/log/page.tsx`
- `visit/[id]/edit/page.tsx`
- `dish/[id]/page.tsx`
- `reservation/[id]/page.tsx`
- `reservation/new/page.tsx`
- `map/page.tsx`
- `year-in-review/page.tsx`
- `settings/page.tsx`
- `import/page.tsx`
- `actions.ts` — server actions wrapping `@mylife/dining` CRUD via better-sqlite3 adapter

**Module registry (packages/module-registry/) — EXTEND**
- `src/types.ts` — add `'dining'` to `ModuleId` union
- `src/constants.ts` — add `dining` entry with metadata
- `src/__tests__/registry.test.ts` — extend tests

**Mobile root (apps/mobile/app/_layout.tsx and apps/mobile/lib/module-icons.ts) — EXTEND**
- Add `dining` icon mapping (recommend Lucide `utensils-crossed` or `restaurant`)
- Register `(dining)` route group in registry-driven route loader

**Web sidebar (apps/web/components/Sidebar.tsx and apps/web/lib/module-icons.ts) — EXTEND**
- Add `dining` sidebar entry with icon

**Cross-module integration (Phase 6 — separate task per host module)**
- `modules/recipes/src/integrations/dining-link.ts` — "From a restaurant visit" recipe creation flow
- `modules/nutrition/src/integrations/dining-import.ts` — log meal nutrition from a dining visit
- `modules/budget/src/integrations/dining-categorizer.ts` — auto-categorize Stripe/Plaid dining transactions to module
- `modules/rsvp/src/integrations/dining-event.ts` — group reservation as RSVP event
- `modules/trails/src/integrations/dining-on-trip.ts` — surface restaurants visited during a trip
- `modules/mood/src/integrations/dining-correlation.ts` — link best meals to mood-positive days
- `modules/pets/src/integrations/dining-pet-friendly.ts` — pet-friendly restaurant flag

**Tests**
- `modules/dining/src/__tests__/email-parser.test.ts` — parse fixtures from Resy, OpenTable, Tock
- `modules/dining/src/__tests__/deep-links.test.ts` — URL builder correctness
- `modules/dining/src/__tests__/restaurant-merge.test.ts`
- `modules/dining/src/__tests__/photo-pipeline.test.ts` — EXIF strip, compression
- `modules/dining/src/__tests__/insights.test.ts`
- `apps/mobile/__tests__/dining/` — screen smoke tests
- `apps/web/__tests__/dining/` — server action tests

**Docs**
- `modules/dining/CLAUDE.md` — module-specific Claude guidance (per `module-claude-md-generator` skill)
- Update `CLAUDE.md` (root) — bump module count from 30 to 31; add `dining` row to Module Table Prefixes; add `dn_` to schema documentation; update Registry vs Host App Wiring section
- Update `AGENTS.md` (root) — same changes as CLAUDE.md (parity rule)
- Update `memory.md` after each phase ships

## Phases

### Phase 0 — Foundation (Week 1-2)

**Goal:** Module scaffold builds, registers, appears in hub navigation as empty placeholder.

**Tasks:**
- Scaffold `modules/dining/` with package.json, tsconfig, definition.ts
- Define ModuleDefinition with id `dining`, prefix `dn_`, tier `pro`, schemaVersion 1
- Add `dining` to `ModuleId` union and `MODULE_REGISTRY` constants
- Create empty SQLite schema with version table
- Create empty CRUD stubs that return empty arrays
- Wire module-registry to load definition
- Mobile: add `(dining)` route group with empty `_layout.tsx` and placeholder `index.tsx`
- Mobile: add module icon mapping
- Web: add `dining` sidebar entry; create empty `page.tsx`
- Web: add settings page
- Apply Cool Obsidian token overrides for module accent color
- Add module to Discover screen mock data
- Test: `pnpm typecheck`, `pnpm test`, hub navigates to module

**Acceptance:**
- Module appears in mobile hub dashboard with icon, name, accent
- Module appears in web sidebar
- Both mobile and web open empty Dining home without errors
- Type-check passes across the workspace
- Settings screen renders with default values
- `pnpm check:parity` passes

### Phase 1 — Restaurant Manager (Week 3-5)

**Goal:** User can add, view, search, edit, and delete restaurants. Map view works.

**Tasks:**
- Implement `dn_restaurants` table migration
- Implement `dn_tags` and `dn_restaurant_tags` migrations
- Implement restaurant CRUD with full Zod validation
- Implement tag CRUD with seeded cuisine tags (Italian, Japanese, Mexican, etc — start with 30 cuisines)
- Build add-restaurant flow (manual entry: name, address, city, cuisines, price tier, website)
- Build paste-URL parser (extract structured data from Resy, OpenTable, Tock, Yelp, Google Maps URLs where possible via OG tags)
- Build restaurant list view with search, sort, filter by cuisine/neighborhood/price/tag
- Build restaurant detail screen (read-only initially)
- Build edit restaurant flow
- Build delete with confirmation
- Build duplicate-detection and merge flow
- Build map view (mobile) reusing Mapbox setup from Trails module
- Build map view (web) using Mapbox web SDK
- Tests: CRUD, paste parser, merge logic

**Acceptance:**
- Can add a restaurant manually
- Can paste a Resy URL and have name/address auto-fill
- Can search/filter/sort 100+ restaurants performantly
- Map view shows restaurants as pins
- Mobile and web have identical functionality
- 90%+ test coverage on CRUD and parser
- `pnpm gate:function:changed` passes

### Phase 2 — Visit Log + Photo Journal (Week 6-8)

**Goal:** User can log a visit with photos, ratings, notes, companions.

**Tasks:**
- Implement `dn_visits`, `dn_photos`, `dn_companions` migrations
- Implement visit, photo, companion CRUD
- Build photo pipeline: compression (target 1MB max), EXIF stripping option, encrypted local storage write (reuse Journal module pattern)
- Build "Log a visit" flow: select restaurant → date/time → party size → occasion → ratings (overall, vibe, food, service) → companions → notes → photos
- Build visit detail screen
- Build per-restaurant visit history view
- Build chronological all-visits view (visits tab)
- Build quick-add visit from restaurant detail
- Build edit visit
- Build delete visit (with photo cleanup)
- Tests: photo pipeline, visit CRUD, EXIF strip correctness

**Acceptance:**
- Can log visit in under 60 seconds (excluding photo capture)
- Photos compress and store encrypted on device
- EXIF location stripping works when enabled in settings
- Visit history sorted correctly (most-recent first)
- Per-restaurant visit count rolls up correctly
- Average rating per restaurant calculates correctly
- Mobile and web parity

### Phase 3 — Dish Tracking (Week 9-10)

**Goal:** User can track individual dishes with ratings, photos, would-order-again, allergens.

**Tasks:**
- Implement `dn_dishes` migration
- Implement dish CRUD
- Build add-dish-to-visit flow (name, course, price, rating, would-order-again, photo, notes, allergens)
- Build dish detail screen
- Build per-restaurant dish history ("things I've had at Carbone")
- Build all-time best dishes view (sorted by rating, would-order-again)
- Build allergen filter and warning surface
- Build "duplicate dish" quick-add (re-order what I had last time)
- Tests: dish CRUD, allergen warnings

**Acceptance:**
- Can add 5 dishes to a visit in under 2 minutes
- Per-restaurant dish list shows all dishes ever ordered with ratings
- All-time best dishes view filters correctly
- Allergen warnings surface during add flow if user has restrictions in settings
- Mobile and web parity

### Phase 4 — Wishlist + Watchlist (Week 11-12)

**Goal:** User can save restaurants to wishlist and set watchlist criteria for hard-to-book ones.

**Tasks:**
- Implement `dn_watchlist` migration
- Add `is_wishlist` flag handling on `dn_restaurants` (already in schema)
- Build wishlist toggle on restaurant detail and list views
- Build wishlist screen (sortable: recently added, by neighborhood, never-attempted)
- Build watchlist add flow (party size, target date range, notify enabled)
- Build watchlist screen
- Implement local notification scheduling for "haven't tried this in 90 days" reminders
- Build "weekly digest" view of wishlist items
- Tests: wishlist toggle, watchlist date ranges, notification scheduling

**Acceptance:**
- Can mark/unmark restaurant as wishlist with one tap
- Wishlist screen shows all flagged restaurants with sort options
- Can add restaurant to watchlist with party size + date range
- Local notifications fire at scheduled times when device permits
- Mobile and web parity (web shows in-app notifications since browser push is heavier lift)

### Phase 5 — Reservations + Deep Linking (Week 13-15)

**Goal:** User can track reservations, deep-link to booking platforms, parse confirmation emails.

**Tasks:**
- Implement `dn_reservations` and `dn_imports` migrations
- Implement reservation CRUD
- Build manual reservation entry flow
- Build reservation calendar view (month + agenda)
- Build deep-link engine: `resy://`, `opentable://`, `yelp://`, `tock://`, web fallback
- Build "Book at [restaurant]" button on restaurant detail that surfaces best-available platform
- Build email parser engine: detect Resy/OpenTable/Tock/Yelp confirmation email formats; extract restaurant, date/time, party size, confirmation code; create draft reservation for user to confirm
- Build email parser surfacing: requires Mail module integration (or pasted-text input as fallback for users without Mail module)
- Build calendar sync (EventKit on iOS, CalendarContract on Android, web fallback to .ics file download)
- Build reservation reminders (90 min, 1 day, 1 week before)
- Build cancellation flow with reason capture
- Build no-show counter with non-judgmental tracking
- Tests: deep-link URL builders, email parser fixtures from real Resy/OpenTable/Tock emails, calendar sync

**Acceptance:**
- Can manually log reservation in under 30 seconds
- "Book" button correctly opens Resy app when restaurant has Resy URL
- "Book" button falls back to web URL when app not installed
- Email parser correctly extracts ≥90% of fields from 20 real Resy/OpenTable/Tock confirmation emails
- Reservation appears in user's system Calendar (when sync enabled)
- Reminders fire at correct times
- Mobile and web parity

### Phase 6 — Cross-Module Integration (Week 16-18)

**Goal:** Dining data connects meaningfully to Recipes, Nutrition, Budget, RSVP, Trails, Mood, and Pets.

**Tasks:**
- **Recipes:** add "Recreate this dish" button on dish detail → opens recipe creation flow with name and notes pre-filled
- **Nutrition:** add "Log to Nutrition" on visit → opens nutrition logging with restaurant name pre-filled and best-effort calorie estimate from dish data
- **Budget:** add visit → budget transaction link if user has Budget module; auto-suggest "Dining Out" category for matching transactions
- **RSVP:** "Invite friends" on a visit log entry → opens RSVP module group event creation
- **Trails:** when a trip is active in Trails, surface "Did you eat anywhere worth remembering?" prompt
- **Mood:** correlation view in Mood Insights showing "Mood scores on days you ate at top-rated restaurants vs other days"
- **Pets:** pet-friendly tag on restaurant; when adding a visit, optional "Brought a pet" toggle
- Build per-host-module integration files following `modules/<host>/src/integrations/dining-*.ts` pattern
- Build cross-module navigation (taps that hop between modules cleanly)
- Tests: integration handlers, cross-module data linking

**Acceptance:**
- Each host module surfaces dining data when relevant
- All cross-module links round-trip correctly (dining → recipes → back to dining)
- No host module breaks if Dining module is disabled
- Mobile and web parity

### Phase 7 — Advanced (Week 19-22, optional / defer until P0-P6 has user signal)

**Goal:** Enhanced features for power users.

**Tasks:**
- Wine cellar: implement `dn_wines` migration and wine CRUD; sommelier-style detail screen
- Year-in-review: annual summary with best meals, most-visited, dish of the year, photo collage
- Recommendations to friends: integration with Forums/Market module's share infra
- CSV / Apple Maps import wizard
- Yelp / Google Maps import (via user-uploaded export files; no API integration)
- Multi-currency support for international travel
- Restaurant heatmap by city visited
- Export to printable "Restaurant Bible" PDF
- Tests: import parsers, year-in-review aggregation

**Acceptance:**
- Wine tracking works end-to-end
- Year-in-review generates a visual summary for any 365-day period
- CSV import handles 1000-row files in under 5 seconds
- Multi-currency conversions display correctly
- Mobile and web parity

## Out of Scope (Explicit Non-Goals)

The following are explicitly NOT in scope for this module, per the design doc rationale:

1. **Real-time restaurant availability search.** No scraping of Resy/OpenTable inventory. Deep-link out only.
2. **Booking transaction execution.** We never see payment cards. Booking happens in the destination platform.
3. **Restaurant directory / database.** Each user maintains their own private restaurant list. No central restaurant database.
4. **Reviews surfacing.** No public review aggregation. Private user notes only.
5. **Restaurant marketing surface.** No promoted restaurants, no advertising, no editorial commerce.
6. **POS integration.** Out of scope (this is restaurant-side functionality MyLife will never build).
7. **PCI compliance scope expansion.** Module avoids any code path that handles card data.
8. **B2B / SaaS for restaurants.** This module is consumer-only.
9. **Real-time push notifications based on availability scraping.** P4 watchlist is local-notification-only based on user check-ins.

## Dependencies

- `packages/db` — SQLite adapter, migration orchestration (existing)
- `packages/ui` — Cool Obsidian tokens, shared components (existing)
- `packages/module-registry` — module metadata + lifecycle (existing)
- `apps/mobile` — Mapbox setup (already integrated in Trails module)
- `modules/journal` — encrypted photo storage pattern (will be referenced)
- `modules/recipes`, `modules/nutrition`, `modules/budget`, `modules/rsvp`, `modules/trails`, `modules/mood`, `modules/pets` — for Phase 6 integration

No new external services. No new vendor accounts. No API keys to provision.

## Success Metrics

Within 90 days of public ship:

- 30%+ of MyLife users with the module enabled log at least one visit
- Average user has 5+ restaurants in their database after 30 days
- Average user has 2+ wishlist items after 30 days
- 80%+ of "Book" deep-link taps successfully open destination app
- Email parser success rate ≥90% on Resy / OpenTable / Tock confirmation emails
- 0 PII data leaks (all data remains local)
- Module accent and design feel native to the rest of the suite

## Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Deep-link URL schemes change | Low | Medium | Always include web URL fallback |
| Email confirmation templates change | Medium | Medium | Versioned parsers + manual entry fallback |
| Apple/Google reject for "deep linking to competitors" | Low | Low | Universal links explicitly permitted |
| Photo storage grows large at scale | Medium | High | Smart compression + optional gallery cleanup tools |
| Module is perceived as inferior to Resy on booking | High | High | Position clearly as companion, not replacement; make deep-link UX excellent |
| Performance degrades with 1000+ visits | Medium | Low | Pagination + indexed queries from day one |

## Open Questions

1. **Module name.** "Dining" is the working ID. Display name options: MyDining, MyTable, Plates, Menu, Palate. **Founder decision required by Phase 0.**
2. **Module accent color.** Warm brown #8B6F47 vs burgundy #8B3A3A. **Founder decision required by Phase 0.**
3. **Wine handling.** Sub-feature of Dining (current plan) or eventual spin-out into a "Cellar" module? Decision: in-Dining for now; revisit at Phase 7.
4. **Photo cloud backup.** Local-only at launch (consistent with Journal). Should there be optional opt-in cloud backup later? Recommend: defer to Y2.
5. **Watchlist availability scraping.** Pure user check-in at launch. Public-page polling considered for future Phase 7+; requires legal review and aggressive rate-limiting.
6. **First-launch geo focus.** Recommend US-first for deep-link priority (Resy, OpenTable, Tock, Yelp). EU/Asia integrations (TheFork, Quandoo, Dimmi) deferred to Phase 7.
7. **Free vs Pro tier.** Recommend Pro (paid). Founder confirms.
8. **Companion data linking.** Currently freeform `display_name`. Future: link to a Contacts module if MyLife adds one. Decision: freeform for launch.
9. **Reservation source for non-MyLife users in group.** When user logs visit with companions, do we offer to share with them via RSVP? Decision: defer to Phase 6 RSVP integration.

## Workstreams (Parallelization)

Phases must run sequentially (each builds on the previous). Within each phase, the following can parallelize:

- Mobile UI work and Web UI work (separate file zones; no conflict)
- CRUD implementation and engine implementation (different files)
- Test writing and feature implementation (test-writer agent + feature agent)
- Documentation updates (docs-agent in parallel with feature agents)

Suggested team for Phase 1-3 sprint:
- 1× hub-shell-dev: mobile (apps/mobile/app/(dining)/)
- 1× hub-shell-dev: web (apps/web/app/(modules)/dining/)
- 1× module-dev: modules/dining/ (CRUD + engine)
- 1× test-writer: tests across all of the above
- 1× docs-agent: CLAUDE.md updates + module CLAUDE.md generation
- Lead: coordinator + design decisions

## Definition of Done (Per Phase)

- [ ] Code passes `pnpm typecheck`
- [ ] Code passes `pnpm test` (module + apps tests green)
- [ ] Code passes `pnpm gate:function:changed`
- [ ] Code passes `pnpm check:parity --quiet`
- [ ] Mobile and web parity verified (same features, same data model surface)
- [ ] Cool Obsidian design tokens applied consistently
- [ ] No PII leaves device (verified by code review)
- [ ] Module CLAUDE.md updated
- [ ] Root CLAUDE.md and AGENTS.md updated where applicable
- [ ] memory.md row added for the phase
- [ ] Session log written to `docs/sessions/YYYY-MM-DD-mydining-phase-N.md`
- [ ] Open Brain capture sent with context `"personal, mylife"`

## Definition of Done (Whole Plan)

- All P0-P6 phases shipped and verified
- Module appears in production registry as `dining`
- Module count documented as 31 across CLAUDE.md, AGENTS.md, README, and pitch materials
- One full year-in-review pre-built and tested with seed data
- Email parser fixtures captured from at least 5 real Resy emails, 5 real OpenTable emails, 5 real Tock emails
- Performance verified at 500 restaurants × 5 visits each (2,500 visit records)
- Privacy audit confirms zero outbound network calls beyond opt-in deep-link navigation and Mapbox map tiles
- Marketing copy approved for the "$12/yr replaces dining-tracking apps" narrative
- Cross-module integrations (P6) functional with at least 4 host modules

## Estimated Total Effort

- Engineering: ~15.5 weeks (P0-P6) + ~4 weeks (P7 optional) = **~20 weeks**
- Design: ~7 weeks
- QA: ~6.5 weeks
- Calendar time at solo-founder + AI velocity: **~3-4 calendar months for P0-P6**, additional **~1 month for P7**

## Companion Documents

- **Design doc:** `/Users/trey/Desktop/Apps/MyLife/docs/plans/modules/dining-module-design-doc-2026-04-19.md` — full strategic rationale, Resy business analysis, competitive landscape, full feature comparison
- **Investor pitch context:** `/Users/trey/Desktop/Apps/MyLife/docs/plans/investor-pitch/session-summary-2026-04-19.md` — overall funding strategy this module fits into
- **Plan template:** `/Users/trey/Desktop/Apps/MyLife/docs/plans/templates/plan-template.md`

## Plan Lifecycle

- Plan starts in `docs/plans/queue/` (this file)
- Move to `docs/plans/active/` when implementation begins
- Move to `docs/plans/done/` when DoD-Whole-Plan satisfied, or `docs/plans/failed/` if abandoned
