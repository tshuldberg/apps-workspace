# Plan: Restaurant Platform Implementation (Dining Module + Restaurant SaaS)

> **STATUS 2026-06-28 (moved queue -> done):** Consumer Dining module is fully shipped (MyDining P0-P7, 166 tests). **Not shipped / open follow-up backlog:** the Restaurant SaaS side (phases R0-R12) remains scaffold-only and dormant 2+ months. Re-file as a fresh standalone plan if the B2B platform is revived.

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyLife Restaurant Platform (Dining consumer module + Restaurant SaaS)
priority: 07
effort: XXL
dependencies: ["packages/db", "packages/ui", "packages/module-registry", "modules/market"]
worktree: true
worktree_name: restaurant-platform
parallel_phases: true
created: 2026-04-20
companion_design_doc: docs/plans/modules/restaurant-platform-design-2026-04-20.md
mission_control: docs/plans/restaurant-platform-mission-control.html
```

## Objective

Ship a complete restaurant platform across two interoperating product surfaces:

1. **Consumer Dining module** (`modules/dining/`) — privacy-first dining log, wishlist, visit/dish/photo journal, reservation tracking, deep-link booking, cross-module integration. Module #31 in MyLife Hub at $12/yr Pro tier. **Year 1.**
2. **Restaurant Reservations SaaS** (`packages/restaurant-saas/`) — full operator platform: floor plan, waitlist, guest CRM, marketing automation, analytics, Stripe Connect deposit/no-show payments, POS integrations with Square + Toast + Lightspeed + Clover. Hosted at $99/mo + $1/booking. **Year 2-3.**

## Scope

### Files Affected (high-level — full file list per phase below)

**New module:** `modules/dining/` — consumer-side dining log + restaurant tracking
**New package:** `packages/restaurant-saas/` — Next.js Restaurant SaaS app (separate from MyLife Hub)
**New shared packages:**
- `packages/payments-advanced/` — Stripe Connect wrapper
- `packages/realtime/` — Supabase Realtime + polling fallback
- `packages/sms/` — Twilio integration with TCPA compliance
- `packages/audit-log/` — immutable event log
- `packages/admin-ui/` — role-based dashboard components
- `packages/pos-adapters/` — POS integration adapter framework + per-POS implementations

**Module registry extension:** add `'dining'` to `ModuleId`, register in constants, add to mobile/web hub navigation
**Cross-module integrations:** new files in `modules/recipes/`, `modules/nutrition/`, `modules/budget/`, `modules/rsvp/`, `modules/trails/`, `modules/mood/`, `modules/pets/`
**Documentation:** root `CLAUDE.md` + `AGENTS.md` updated; `modules/dining/CLAUDE.md` and `packages/restaurant-saas/CLAUDE.md` created

## Phases

Phases for the consumer Dining module (P0-P7) ship first; Restaurant SaaS phases (R0-R12) start in parallel from M5 once the foundation is stable.

---

### Phase P0 — Dining Module Foundation (Week 1-2)

**Goal:** Module scaffold builds, registers, appears in hub navigation as empty placeholder.

**Tasks:**
- Scaffold `modules/dining/` per existing module pattern (clone `modules/forums/` as starting reference for cloud-capable modules)
- Define ModuleDefinition: id `dining`, prefix `dn_`, tier `pro`, schemaVersion 1, accent `#DC2626`
- Add `dining` to `ModuleId` union in `packages/module-registry/src/types.ts`
- Add to MODULE_REGISTRY constants
- Empty SQLite schema with version table
- Empty CRUD stubs
- Mobile: `(dining)` route group, empty `_layout.tsx`, placeholder `index.tsx`
- Web: `dining` sidebar entry, empty `page.tsx`, settings page
- Apply Cool Obsidian token overrides for warm restaurant red accent
- Add to Discover screen mock data
- Update root CLAUDE.md + AGENTS.md (module count 30 → 31)

**Acceptance:**
- Module appears in mobile hub dashboard with red accent
- Module appears in web sidebar
- Both surfaces open empty Dining home without errors
- `pnpm typecheck`, `pnpm test`, `pnpm check:parity` pass

---

### Phase P1 — Restaurant Manager (Week 3-5)

**Goal:** Add, view, search, edit, delete restaurants. Map view works.

**Tasks:**
- Implement `dn_restaurants`, `dn_tags`, `dn_restaurant_tags` migrations
- Restaurant CRUD with full Zod validation
- Tag CRUD with seeded cuisine tags (30 cuisines)
- Add-restaurant flow: manual entry + paste-URL parser (Resy/OpenTable/Tock/Yelp/Google Maps OG-tag extraction)
- Restaurant list: search, sort, filter by cuisine/neighborhood/price/tag
- Restaurant detail screen
- Edit / delete / merge duplicates
- Map view (mobile reuses Mapbox from Trails; web uses Mapbox web SDK)
- Tests: CRUD, paste parser, merge logic

**Acceptance:**
- Can add restaurant manually
- Paste a Resy URL → auto-fills name/address
- Search/filter/sort 100+ restaurants performantly
- Map view shows restaurants as pins
- Mobile + web parity, 90%+ test coverage on CRUD

---

### Phase P2 — Visit Log + Photo Journal (Week 6-8)

**Goal:** Log visits with photos, ratings, notes, companions.

**Tasks:**
- Implement `dn_visits`, `dn_photos`, `dn_companions` migrations
- Visit, photo, companion CRUD
- Photo pipeline: compression (1MB max), EXIF strip option, encrypted local storage write (reuse Journal pattern)
- "Log a visit" flow: select restaurant → date/time → party size → occasion → ratings → companions → notes → photos
- Visit detail screen
- Per-restaurant visit history
- Chronological all-visits view
- Quick-add visit from restaurant detail
- Edit + delete visit (with photo cleanup)
- Tests: photo pipeline, EXIF strip, visit CRUD

**Acceptance:**
- Can log visit in <60 seconds (excluding photo capture)
- Photos compress and store encrypted on device
- EXIF location stripping works when enabled in settings
- Per-restaurant visit count + average rating roll up correctly
- Mobile + web parity

---

### Phase P3 — Dish + Wine Tracking (Week 9-10)

**Goal:** Track individual dishes and wines with ratings, photos, allergens.

**Tasks:**
- Implement `dn_dishes` and `dn_wines` migrations
- Dish + wine CRUD
- Add-dish-to-visit flow: name, course, price, rating, would-order-again, photo, notes, allergens
- Add-wine-to-visit flow: producer, name, vintage, region, varietal, rating, bottle/glass price, pairing notes
- Dish detail screen
- Per-restaurant dish history ("things I've had at Carbone")
- All-time best dishes view
- Allergen flag and warning surface
- "Duplicate dish" quick-add (re-order what I had last time)
- Tests: dish/wine CRUD, allergen warnings

**Acceptance:**
- Can add 5 dishes to a visit in <2 minutes
- Per-restaurant dish list shows all dishes ever ordered
- Allergen warnings surface during add flow if user has restrictions
- Mobile + web parity

---

### Phase P4 — Wishlist + Watchlist (Week 11-12)

**Goal:** Save restaurants to wishlist; set watchlist criteria for hard-to-book.

**Tasks:**
- Implement `dn_watchlist` migration
- `is_wishlist` flag handling on `dn_restaurants`
- Wishlist toggle on restaurant detail and list
- Wishlist screen (sortable: recently added, neighborhood, never-attempted)
- Watchlist add flow (party size + date range + notify enabled)
- Watchlist screen
- Local notification scheduling for wishlist reminders
- Weekly digest view of wishlist items
- Tests: wishlist toggle, watchlist date ranges, notifications

**Acceptance:**
- Mark/unmark wishlist with one tap
- Watchlist add flow captures all required fields
- Local notifications fire at scheduled times
- Mobile + web parity

---

### Phase P5 — Reservations + Deep Linking (Week 13-15)

**Goal:** Track reservations; deep-link to booking platforms; parse confirmation emails.

**Tasks:**
- Implement `dn_reservations` and `dn_imports` migrations
- Reservation CRUD
- Manual reservation entry flow
- Reservation calendar view (month + agenda)
- Deep-link engine: `resy://`, `opentable://`, `yelp://`, `tock://`, web fallback
- "Book at [restaurant]" button surfaces best-available platform per restaurant URLs
- Email parser: detect Resy/OpenTable/Tock/Yelp confirmation formats; extract restaurant, date/time, party size, confirmation code; create draft reservation for user confirmation (paste-text fallback if Mail module not active)
- Calendar sync (EventKit on iOS, CalendarContract on Android, .ics download for web)
- Reservation reminders (90 min, 1 day, 1 week before)
- Cancellation flow with reason
- No-show counter (non-judgmental)
- Tests: deep-link URL builders, email parser fixtures from real confirmation emails, calendar sync

**Acceptance:**
- Manual log reservation in <30 seconds
- "Book" opens correct platform when restaurant has matching URL
- Email parser ≥90% field extraction success on 20 real confirmation emails
- Reservation appears in user's system Calendar (when sync enabled)
- Mobile + web parity

---

### Phase P6 — Cross-Module Integration (Week 16-18)

**Goal:** Dining data connects to Recipes, Nutrition, Budget, RSVP, Trails, Mood, Pets.

**Tasks:**
- **Recipes:** "Recreate this dish" button on dish detail → opens recipe creation flow with name + notes pre-filled
- **Nutrition:** "Log to Nutrition" on visit → opens nutrition log with restaurant pre-filled and best-effort calorie estimate
- **Budget:** auto-suggest "Dining Out" category for matching transactions; visit → budget transaction link
- **RSVP:** "Invite friends" on visit → opens RSVP group event creation
- **Trails:** when trip active in Trails, surface "Did you eat anywhere worth remembering?"
- **Mood:** correlation view in Mood Insights ("Mood scores on days you ate at top-rated restaurants vs other days")
- **Pets:** pet-friendly tag on restaurant; "Brought a pet" toggle on visit log
- Build per-host-module integration files following `modules/<host>/src/integrations/dining-*.ts` pattern
- Cross-module navigation (clean hops between modules)
- Tests: integration handlers, cross-module data linking

**Acceptance:**
- Each host module surfaces dining data when relevant
- All cross-module links round-trip correctly
- No host module breaks if Dining is disabled
- Mobile + web parity

---

### Phase P7 — Advanced Consumer Features (Week 19-22, optional)

**Goal:** Year-in-review, AI Concierge, advanced features.

**Tasks:**
- Year-in-review: best meals, most-visited, dish of the year, photo collage
- **Cross-platform AI Concierge:** searches Resy/OpenTable/Tock/Yelp public data + user wishlist + walk-in availability; presents unified results
- CSV / Apple Maps / Yelp / Google Maps import wizard
- Multi-currency support for travelers
- Restaurant heatmap by city visited
- Export to printable "Restaurant Bible" PDF
- Tests: year-in-review aggregation, import parsers

**Acceptance:**
- Year-in-review generates visual summary for any 365-day period
- AI Concierge returns unified results across at least 2 platforms
- CSV import handles 1000-row files in <5 seconds

---

### Phase R0 — Restaurant SaaS Foundation (Month 6, Week 1-2)

**Goal:** `packages/restaurant-saas/` package scaffolds with Next.js 15, Supabase, deployed to Vercel.

**Tasks:**
- Create `packages/restaurant-saas/` Next.js 15 App Router app
- Configure Supabase project (Postgres + Auth + Realtime + Storage)
- Define canonical schema migrations: `restaurants`, `restaurant_users`, `floor_areas`, `floor_tables`, `floor_layouts`
- Set up RLS policies for restaurant_id-based isolation
- Auth flow: restaurant owner sign-up + sign-in
- Cool Obsidian theme tokens applied to admin shell
- Scaffold `packages/admin-ui/` with initial shared components (permission guard, table, form wizard, status badge) used by admin pages
- Empty placeholder pages for: Dashboard, Floor Plan, Reservations, Waitlist, Guests, Marketing, Analytics, Settings
- Deploy to Vercel preview environment
- CI/CD pipeline

**Acceptance:**
- Restaurant owner can sign up at reservations.mylife.app
- Empty admin shell renders with Cool Obsidian dark theme
- Supabase RLS prevents cross-restaurant data access
- Deployment automated from main branch

---

### Phase R1 — Stripe Connect Integration (Month 6, Week 3-5)

**Goal:** Restaurants onboard via Embedded Components; can accept booking deposits.

**Tasks:**
- Build `@mylife/payments-advanced` package wrapping Stripe Connect Standard
- Implement Connect onboarding flow with Embedded Components (`<ConnectAccountOnboarding />`)
- Implement webhook receiver `/api/webhooks/stripe` with idempotency (`webhook_events` table)
- Handle webhook events: `account.updated`, `account.application.deauthorized`, `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`, `payment_intent.canceled`, `charge.captured`, `charge.refunded`, `charge.dispute.created`, `transfer.created`, `payout.paid`
- Implement booking deposit flow: PaymentIntent with `capture_method: 'manual'`, `on_behalf_of`, `transfer_data`, `application_fee_amount`
- Implement restaurant dashboard: `<ConnectPayments />`, `<ConnectPayouts />`, `<ConnectAccountManagement />`
- Restaurant onboarding wizard: connect Stripe → policies → first booking
- California SB 1524 compliance: policy disclosure UI + consent capture (`policy_version_id`, `consent_at`, `consent_ip` stored on every reservation)
- Tests: webhook idempotency, manual capture lifecycle, refund flows

**Acceptance:**
- Restaurant can complete Stripe Connect onboarding (KYC, bank account)
- Restaurant can configure no-show fee policy with explicit consent text
- Test diner can book reservation with $25 deposit auth (manual capture, not yet captured)
- Webhook events processed idempotently

---

### Phase R2 — Floor Plan Editor (Month 7, Week 1-3)

**Goal:** Restaurant builds and manages multi-area floor plan with drag-drop.

**Tasks:**
- Floor plan editor canvas (drag-drop primitives: round, square, rectangle, banquette, bar, host stand)
- Snap-to-grid (8px or 16px, toggleable)
- Multi-area tabs (Main, Patio, Bar, Private Dining)
- Per-table metadata: capacity_min, capacity_max, combinable_with, server_zone
- Saved layouts (NYE, Buyout) with one-click swap
- Service mode lock to prevent accidental drags during dinner rush
- Real-time multi-user updates via `@mylife/realtime` (build this package first)
- **Innovation: AI floor plan from photo** — operator uploads photo; CV model proposes table primitives; operator confirms/edits (defer to Phase R10 if CV model integration takes too long)
- Tests: state model, snap-to-grid, multi-area switching

**Acceptance:**
- Restaurant can build a 40-table floor plan in <15 minutes
- Real-time updates propagate within 500ms
- Service mode lock prevents drag during active service
- Saved layouts swap correctly

---

### Phase R3 — Reservation Calendar + Booking (Month 7, Week 4 — Month 8, Week 1)

**Goal:** Reservations flow from booking → seated → completed.

**Tasks:**
- Implement `reservations` and `reservation_policies` migrations
- Reservation CRUD (with RLS)
- Calendar views: day (timeline × tables grid), agenda, week
- Color codes per status (blue=confirmed, yellow=arrived, green=seated, gray=closed, red=no-show)
- VIP crown badge persistent
- Drag-to-reschedule with conflict detection
- **Pacing visualization** (covers-per-15-min vs kitchen capacity ceiling)
- Source attribution per booking
- Diner-facing booking page at `/r/[slug]` with policy disclosure + checkbox consent
- "Mark seated" / "Mark no-show" actions wire to Stripe capture/cancel
- Reservation modification flow
- Tests: booking → seated → completed lifecycle, drag-reschedule conflict detection

**Acceptance:**
- Diner can book a reservation at a real restaurant
- Restaurant sees reservation in calendar within seconds
- Marking "seated" cancels Stripe auth (no charge)
- Marking "no-show" T+30min captures deposit fee
- Pacing visualization reflects current cover load

---

### Phase R4 — Waitlist + Walk-in (Month 8, Week 2-3)

**Goal:** Walk-in waitlist with two-way SMS and transparent position.

**Tasks:**
- Build `@mylife/sms` package (Twilio integration with TCPA send-window enforcement)
- Implement `waitlist` migration
- Walk-in add flow (party size, dietary notes, phone, opt-in SMS)
- Two-way SMS thread: join confirmation → ready alert → +2 min reminder → auto-release at +10 min
- Quote time as range ("25-35 min") with under-promise heuristic
- **Transparent position-in-line** for diner ("you're #4, ETA 30min based on history") — diner-side view at `/r/[slug]/wait/[token]`
- Walk-away swipe with three reasons
- Kitchen pacing signal (host can pause new adds when tickets back up)
- Tests: SMS lifecycle, quote-time accuracy, walk-away handling

**Acceptance:**
- Walk-in joins waitlist, receives SMS confirmation
- Diner can check live position via web link
- Auto-release fires after 10 min of no response to ready ping
- Quote time recalibrates as floor changes

---

### Phase R5 — Guest CRM (Month 8, Week 4 — Month 9, Week 1)

**Goal:** Restaurant maintains guest profiles with allergens, preferences, history.

**Tasks:**
- Implement `diners` and `restaurant_diner_profiles` migrations
- Diner profile auto-built from booking history
- Allergen flagging (red, persistent, on every screen, on kitchen ticket auto-print)
- Visit count + lifetime spend (POS-attributed where available)
- VIP toggling + auto-tag rules with explainability
- Do-not-seat list (manager PIN required to remove)
- **Diner sovereignty:** profile is read-only at restaurant — diner controls preferences via MyLife Dining module; restaurant only sees what diner shared at booking time
- Tests: profile aggregation, auto-tag explainability, allergen surface

**Acceptance:**
- Restaurant can view guest profile from reservation
- Allergens display in red across all surfaces
- Auto-tags include reason ("Tagged VIP because: 12+ visits, $200+ avg check")
- Manager PIN required for do-not-seat actions

---

### Phase R6 — Email + SMS Marketing (Month 9, Week 2-3)

**Goal:** Restaurants send compliant marketing campaigns to segmented audiences.

**Tasks:**
- Implement `audiences`, `campaigns`, `templates` migrations
- Audience builder with rule-based segments (visit_count_gte, last_visit_lt, allergen filter)
- Restaurant-specific templates (birthday, anniversary, win-back, post-visit, event invite)
- **One-screen send flow** (segment + template + send) — no campaign canvas
- Send-time enforcement based on diner timezone
- Pre-flight compliance check (consent flag, send-window, unsubscribe link)
- Email via Resend; SMS via `@mylife/sms` package
- Deliverability warm-up wizard for new domains (DMARC/SPF/DKIM setup)
- Tests: audience evaluation, compliance check, template rendering

**Acceptance:**
- Restaurant can build a "Last visit > 60 days" segment in <2 minutes
- Send a campaign to that segment in 3 taps
- TCPA send-window enforced (no SMS outside 8am-9pm local)
- Unsubscribe link in every send
- Bounced emails surfaced in dashboard

---

### Phase R7 — Analytics Dashboard (Month 9, Week 4)

**Goal:** Operator sees the numbers that matter daily.

**Tasks:**
- Home tile: covers vs forecast (one number)
- RevPASH (revenue per available seat hour)
- Table turn time
- No-show rate (per channel: web, phone, walk-in)
- Server performance (cohort, not leaderboard)
- Day-part heatmaps
- Compare-to-last toggle on every chart
- CSV export from every chart
- Marketing campaign ROI (if `campaigns` table populated)
- Tests: aggregation accuracy, channel attribution

**Acceptance:**
- Home dashboard loads in <1 sec
- All charts have compare-to-last toggle
- CSV export downloads correctly
- Server performance shown as cohort

---

### Phase R8 — POS Integration Foundation + Square (Month 10)

**Goal:** Build the POS integration framework and ship the first integration.

**Tasks:**
- Build `@mylife/pos-adapters` package with `ReservationPosAdapter` interface
- Implement async event-driven core: webhook gateway with HMAC verification, normalized event schema, outbound write queue with retry + DLQ
- Token vault (per-tenant rotation, location-scoped)
- Reconciliation job runner (daily diff between local state and POS read API)
- **Square Bookings adapter:** auth (OAuth 2.0 with `APPOINTMENTS_READ`, `APPOINTMENTS_WRITE`), `searchAvailability`, `createReservation` (mapped from appointment), `markSeated`, `cancel`, webhook receiver for `booking.created`, `booking.updated`
- Square sandbox testing
- Submit Square App Marketplace listing
- Tests: adapter interface contract, webhook idempotency, reconciliation accuracy

**Acceptance:**
- Restaurant with existing Square account can connect via OAuth
- Reservation booked in MyLife appears in their Square calendar within 10 seconds
- Marking seated in either system propagates to the other
- Reconciliation job catches webhook drops

---

### Phase R9 — Toast POS Adapter (Month 10-11)

**Goal:** Toast integration despite no native reservations API.

**Tasks:**
- File Toast Partner Application early (3-4 week approval)
- Implement Toast adapter using order-as-reservation modeling
- Reservation → Toast order with reservation-specific metadata (party size, time slot, dietary notes attached as order properties)
- Service hours from Toast restaurants API
- Webhook integration for order state changes
- Handle Toast's 1000 req/min/location rate limit
- Tests: order modeling correctness, rate limit handling

**Acceptance:**
- Toast partner approval received (or appeals submitted)
- Reservation creates corresponding Toast order with all metadata
- Order state changes (seated, completed, voided) propagate back to MyLife

---

### Phase R10 — Lightspeed K-Series Adapter + Ops Tooling (Month 11)

**Goal:** Lightspeed K (best reservation API of all POSes) integration + production ops posture.

**Tasks:**
- File Lightspeed Technical Partner Manager request
- Implement Lightspeed K-Series adapter (cleanest API: native reservations, deposits flow into POS as payment)
- Webhook integration with rich auth options (OAuth 2.0 client_credentials)
- Build `@mylife/audit-log` package + audit_events table integration
- Status page (Statuspage.io) live at status.mylife.app
- PagerDuty integration with on-call rotation
- Sentry error tracking + RUM
- Datadog or Grafana Cloud for infra metrics
- Documented runbooks for top 20 failure modes
- Tests: adapter contract, audit log capture

**Acceptance:**
- Lightspeed K integration in production
- Status page live with green status
- PagerDuty fires on Sev1 incidents
- Audit log captures all CRUD operations on critical entities

---

### Phase R11 — Clover + Omnivore (Month 12)

**Goal:** Top-5 POS coverage (~75% of US restaurants).

**Tasks:**
- Implement Clover adapter (REST API + Android device app for staff UX if budget allows)
- Submit Clover App Market listing (4-6 week review, 30% rev share)
- Integrate Omnivore (Olo) for Aloha/Brink/Micros enterprise POS coverage without dedicated engineering
- Omnivore subscription cost negotiated
- Tests: Clover adapter, Omnivore proxy

**Acceptance:**
- Clover restaurants can connect via App Market
- Aloha/Brink/Micros restaurants can connect via Omnivore
- Combined POS coverage: ~75% of US restaurants

---

### Phase R12 — Differentiator Features + AI (Month 13)

**Goal:** Ship the wedge features that make incumbents look extractive by comparison.

**Tasks:**
- AI floor plan from photo (Computer Vision model integration)
- Predictive walk-in surge window (weather + day + neighborhood signals)
- Server zone heatmap (real-time check-touch latency overlaid on floor plan)
- Allergen-aware kitchen alert pre-print
- Bill-split + tip-fairness at-table (without POS lock-in)
- Sustainability/dietary discovery filters (woman-owned, BIPOC-owned, farm-direct, vegan-first, etc)
- Diner-owned data export (JSON/CSV)
- Tests: each differentiator feature

**Acceptance:**
- AI floor plan generates within 30 seconds from a phone photo
- Predictive surge window shows next 30-min walk-in probability
- Server zones color-coded by current load
- Diners can export complete history

---

### Phase R13 — NYC Beachhead Acquisition (Month 14-18)

**Goal:** First 50-100 NYC restaurants live on the platform by Month 18; expand to 200+ by Month 21.

**Tasks:**
- Founder-led restaurant acquisition (visit indie restaurants in NYC)
- Sideloading + onboarding support (target <60 min per restaurant)
- First-week support for each new restaurant
- Press cycle (TechCrunch, The Verge, 404 Media, Eater, Grub Street) tied to incumbent stumbles
- Aligned creator / food influencer outreach (free Pro for restaurants)
- Subreddit + Mastodon presence in r/foodNYC, r/AskNYC, r/FoodPros
- Bandwidth-realistic plan: 8-15 restaurants per founder per month, sustainable for 6 months before second hire needed

**Acceptance:**
- 50-100 NYC restaurants on the platform
- Average restaurant generates 30+ reservations/month via MyLife
- NPS from restaurant operators > 50
- 2-3 tier-1 press placements

---

## Out of Scope (Explicit Non-Goals)

1. **Restaurant POS replacement.** Restaurant keeps using Toast/Square/etc. We integrate, don't replace.
2. **First-party hardware sales.** BYOD with certified configurations only.
3. **Pay-at-table standalone.** Restaurant uses POS for the bill; we only handle deposits and no-show fees.
4. **Resy/OpenTable/TouchBistro POS integrations.** Competitive blockers; deep-link out only.
5. **Banking license / money transmitter.** Year 5+ separate company decision.
6. **Restaurant marketplace consumer surface aggregating Resy/OpenTable/Tock listings as our own.** Cross-platform Concierge surfaces results but does not host them as ours.
7. **Diner-facing reviews of restaurants.** No public review system; private notes in Dining module only. (Reviews are an OpenTable moat we don't fight on.)
8. **Friend graph + group polling.** Requires a social identity layer not yet built. Strategic differentiator but deferred past initial launch; evaluate after first cohort feedback.
9. **Lightspeed U-Series (Upserve) POS adapter.** US legacy account coverage. Deferred past initial launch; evaluate demand from first restaurant cohort.

## Dependencies

- `packages/db` — SQLite + migration orchestration (existing)
- `packages/ui` — Cool Obsidian tokens + shared components (existing)
- `packages/module-registry` — module metadata + lifecycle (existing)
- `modules/forums/`, `modules/market/` — reference patterns for cloud-backed modules
- `modules/journal/` — encrypted photo storage pattern
- New packages built in this plan: `payments-advanced`, `realtime`, `sms`, `audit-log`, `admin-ui`, `pos-adapters`
- External: Supabase project, Stripe Connect platform account, Twilio account, Resend account, Mapbox account, PagerDuty + Statuspage subscriptions
- Partner approvals: Square (no gate), Toast (3-4 weeks), Lightspeed (relationship-paced), Clover (4-6 weeks), Omnivore (negotiated)

## Success Metrics

**Consumer Dining module (Year 1):**
- 30% of MyLife users with module enabled log at least one visit within 90 days
- Average user has 5+ restaurants in database after 30 days
- Average user has 2+ wishlist items after 30 days
- 80%+ of "Book" deep-link taps successfully open destination app
- Email parser ≥90% success rate on real Resy/OpenTable/Tock confirmation emails
- Zero PII data leaks (all data remains local)

**Restaurant SaaS (Year 2-3):**
- 50-100 NYC restaurants live by Month 18; 200+ by Month 21
- Average restaurant: 30+ MyLife-attributed reservations/month
- Net revenue per restaurant: ~$199/mo ($99 subscription + ~100 bookings/mo)
- Restaurant NPS > 50
- Onboarding completion rate > 70% (vs Toast 14-day playbook benchmark)
- Time-to-first-reservation < 60 min for self-serve
- Reservation system uptime ≥ 99.9%
- Friday-night Sev1 incidents = 0 in first 6 months of GA

## Risks

See [`docs/plans/modules/restaurant-platform-design-2026-04-20.md`](../modules/restaurant-platform-design-2026-04-20.md) Section 9 for full risk register. Top 3:

1. **Multi-tenant RLS bug leaking restaurant data** (Catastrophic / Low). Mitigation: pen-test before launch, row-level integration tests, audit logs.
2. **Friday-night Sev1 in first 6 months damages first-cohort reputation** (Catastrophic / Medium). Mitigation: $50-80K/yr ops tooling and 24/7 on-call from Day 1 of GA.
3. **State no-show fee regulation creep** (High / Medium). Mitigation: policy versioning + explicit consent capture from Day 0.

## Workstreams (Parallelization)

**Sequential gates:**
- P0 must complete before P1-P7
- P0 must complete before R0
- R0 must complete before all other R phases
- R1 (payments) must complete before R3 (booking)
- R2 (floor plan) must complete before R3 (calendar can reference tables)
- R3 (booking) must complete before R4 (waitlist) and R5 (CRM)

**Parallelizable:**
- P-phases run in parallel with R-phases from M5 onward
- Within each phase, mobile UI work and web UI work can parallelize
- CRUD and engine work can parallelize
- Tests can parallelize with feature implementation

**Suggested team for parallel execution:**
- Lead (founder): coordination, restaurant acquisition (R13), strategic decisions
- 1 hub-shell-dev for mobile (apps/mobile)
- 1 hub-shell-dev for web (apps/web)
- 1 module-dev for `modules/dining/`
- 1 module-dev for `packages/restaurant-saas/` once R0 starts
- 1 test-writer
- 1 docs-agent

## Definition of Done (Per Phase)

- [ ] Code passes `pnpm typecheck`
- [ ] Code passes `pnpm test`
- [ ] Code passes `pnpm gate:function:changed`
- [ ] Code passes `pnpm check:parity --quiet`
- [ ] Mobile + web parity verified (consumer module phases)
- [ ] Cool Obsidian design tokens applied consistently
- [ ] No PII leaves device beyond explicit user actions
- [ ] Module/package CLAUDE.md updated
- [ ] Root CLAUDE.md + AGENTS.md updated where applicable
- [ ] memory.md row added
- [ ] Session log written to `docs/sessions/YYYY-MM-DD-restaurant-platform-phase-N.md`
- [ ] Mission control HTML updated (status, sync timestamp)

## Definition of Done (Whole Plan)

- All P0-P6 + R0-R12 phases shipped and verified
- 31 modules registered (consumer Dining live)
- Restaurant SaaS hosted at reservations.mylife.app
- 50+ NYC restaurants live on the platform
- Top-5 POS coverage (~75% of US restaurants)
- Status page live, ops posture production-grade
- Audit log capturing all critical events
- California SB 1524 + TCPA + CAN-SPAM + PCI SAQ A all verified
- Mission lock applied (PBC scope refinement documented)

## Estimated Total Effort (AI-amplified)

- Consumer Dining (P0-P7): ~3-4 calendar months casual building (15-20 weeks of focused engineering equivalent)
- Restaurant SaaS (R0-R12): ~9-12 calendar months including partner-application calendar time
- NYC beachhead (R13): 4-6 calendar months overlapping with R10-R12

**Total calendar time to full launch:** 12-18 months

## Companion Documents

- **Design doc:** `/docs/plans/modules/restaurant-platform-design-2026-04-20.md`
- **Mission control HTML:** `/docs/plans/restaurant-platform-mission-control.html`
- **Prior dining module design:** `/docs/plans/modules/dining-module-design-doc-2026-04-19.md`
- **Investor pitch context:** `/docs/plans/investor-pitch/session-summary-2026-04-19.md`
- **Plan template:** `/docs/plans/templates/plan-template.md`

## Plan Lifecycle

- Plan starts in `docs/plans/queue/` (this file)
- Move to `docs/plans/active/` when implementation begins
- Move to `docs/plans/done/` when DoD-Whole-Plan satisfied, or `docs/plans/failed/` if abandoned
