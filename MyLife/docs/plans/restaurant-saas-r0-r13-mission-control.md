# MyLife Restaurant Reservations SaaS: R0-R13 Mission Control

**Product:** MyLife Reservations -- $99/mo + $1/booking restaurant operator platform
**Package:** `packages/restaurant-saas/` (separate Next.js 15 app, NOT a MyLife hub module)
**Hosted at:** reservations.mylife.app
**Theme:** Cool Obsidian dark with `#DC2626` red accent
**Database:** Supabase Postgres, multi-tenant RLS by `restaurant_id`
**Payments:** Stripe Connect Standard (SAQ A PCI scope)
**SMS:** Twilio via `@mylife/sms`
**Email:** Resend
**Realtime:** Supabase Realtime via `@mylife/realtime`
**Status:** Consumer dining module (P0-P7) is COMPLETE. R0-R13 is the next body of work.

---

## Prerequisite: Consumer Dining Module (DONE)

The consumer-side `modules/dining/` is fully shipped (P0-P7):
- 36 source files, 15 test files, 166 tests passing
- 19 mobile screens, 20 web files
- 6 schema migrations, 12 tables (dn_ prefix)
- 7 cross-module integrations (recipes, nutrition, budget, rsvp, trails, mood, pets)
- Year-in-review engine, CSV/Google Maps import wizard
- Handoff: `docs/sessions/2026-04-20-dining-module-handoff.md`
- Module CLAUDE.md: `modules/dining/CLAUDE.md`

---

## Dependency Graph

```
R0 (Foundation) ──┬──> R1 (Stripe Connect) ──┬──> R3 (Reservations + Booking)
                  │                           │         │
                  └──> R2 (Floor Plan) ───────┘         ├──> R4 (Waitlist)    ──> R6 (Marketing)
                                                        ├──> R5 (Guest CRM)  ──> R6
                                                        ├──> R7 (Analytics)   [parallel after R3]
                                                        └──> R8 (POS Framework + Square)
                                                                 │
                                                                 ├──> R9 (Toast)    [gated by partner approval]
                                                                 ├──> R10 (Lightspeed + Ops) [gated by partner approval]
                                                                 └──> R11 (Clover + Omnivore)
                                                                           │
                                                                           └──> R12 (Differentiator Features + AI)
                                                                                     │
                                                                                     └──> R13 (NYC Beachhead)
```

**Parallelizable pairs:**
- R1 + R2 can run in parallel (both depend only on R0)
- R4 + R5 + R7 can run in parallel (all depend only on R3)
- R9 + R10 can run in parallel (both depend on R8, but gated by external partner approvals)

---

## New Shared Packages (built during R-phases)

| Package | Built In | Purpose |
|---------|----------|---------|
| `@mylife/payments-advanced` | R1 | Stripe Connect Standard wrapper (onboarding, manual capture, webhooks, disputes) |
| `@mylife/realtime` | R2 | Supabase Realtime + polling fallback (floor plan sync, reservation updates) |
| `@mylife/sms` | R4 | Twilio integration with TCPA send-window enforcement |
| `@mylife/audit-log` | R10 | Immutable event log with append-only enforcement |
| `@mylife/admin-ui` | R0+ | Shared React components for role-based dashboards (permission guard, tables, forms, badges) |
| `@mylife/pos-adapters` | R8 | ReservationPosAdapter interface + per-POS implementations |

---

## Phase R0: Restaurant SaaS Foundation

**Goal:** `packages/restaurant-saas/` scaffolds with Next.js 15, Supabase, deployed to Vercel.
**Duration:** ~2 weeks
**Dependencies:** None (starts the SaaS track)

### Prompts

#### R0-A: Package scaffold + Supabase + Cool Obsidian theme

**Files to create:**
- `packages/restaurant-saas/` -- Next.js 15 App Router app
- `packages/restaurant-saas/package.json` -- dependencies: next@15, @supabase/supabase-js, @supabase/ssr
- `packages/restaurant-saas/supabase/` -- migration files
- `packages/admin-ui/` -- initial shared components

**Tasks:**
1. Create `packages/restaurant-saas/` Next.js 15 App Router app with TypeScript strict mode
2. Configure Supabase project (Postgres + Auth + Realtime + Storage)
3. Schema migrations:
   - `restaurants` (id, slug, legal_name, display_name, stripe_account_id, charges_enabled, payouts_enabled, country, timezone, cuisines text[], price_tier, hours jsonb, policies jsonb, branding jsonb, capabilities jsonb, status, created_at, updated_at)
   - `restaurant_users` (id, restaurant_id, user_id, role [owner|manager|host|server|marketing], can_manage_billing, can_manage_staff, invited_at, accepted_at)
   - `floor_areas` (id, restaurant_id, name, display_order, active)
   - `floor_tables` (id, area_id, shape [round|square|rectangle|banquette|bar], pos_x, pos_y, width, height, rotation, capacity_min, capacity_max, combinable_with uuid[], server_zone, table_number, active)
   - `floor_layouts` (id, restaurant_id, name, snapshot jsonb)
4. Set up RLS policies for restaurant_id-based isolation on all tables
5. Auth flow: restaurant owner sign-up + sign-in (Supabase Auth with email+password)
6. Cool Obsidian theme tokens applied to admin shell:
   - bg: #0E0E13, surface: #131318, text: #E4E1E9, text-secondary: #D6C3B5
   - accent: #DC2626, border: rgba(255,255,255,0.06), glass: rgba(255,255,255,0.03)
7. Scaffold `packages/admin-ui/` with initial components: PermissionGuard, DataTable, FormWizard, StatusBadge
8. Create empty placeholder pages: Dashboard, Floor Plan, Reservations, Waitlist, Guests, Marketing, Analytics, Settings
9. Admin layout with sidebar navigation (Cool Obsidian styling, restaurant name + role in header)
10. Deploy to Vercel preview environment
11. CI/CD pipeline (typecheck + lint + test on PR)
12. Create `packages/restaurant-saas/CLAUDE.md`

**Acceptance:**
- Restaurant owner can sign up at reservations.mylife.app
- Empty admin shell renders with Cool Obsidian dark theme
- Supabase RLS prevents cross-restaurant data access (verified with integration test)
- Deployment automated from main branch
- `pnpm typecheck` and `pnpm test` pass

---

## Phase R1: Stripe Connect Integration

**Goal:** Restaurants onboard via Embedded Components; can accept booking deposits.
**Duration:** ~3 weeks
**Dependencies:** R0

### Prompts

#### R1-A: @mylife/payments-advanced package + Stripe Connect onboarding

**Files to create:**
- `packages/payments-advanced/` -- new shared package
- `packages/payments-advanced/src/connect.ts` -- Connect Standard onboarding helpers
- `packages/payments-advanced/src/webhooks.ts` -- webhook receiver with idempotency
- `packages/payments-advanced/src/types.ts` -- Stripe event types, payment intent types

**Tasks:**
1. Build `@mylife/payments-advanced` package wrapping Stripe Connect Standard
2. Connect onboarding flow using Embedded Components (`<ConnectAccountOnboarding />`)
3. Account links for returning to onboarding if interrupted
4. Webhook receiver at `/api/webhooks/stripe` with idempotency (`webhook_events` table):
   - Events: `account.updated`, `account.application.deauthorized`, `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`, `payment_intent.canceled`, `charge.captured`, `charge.refunded`, `charge.dispute.created`, `transfer.created`, `payout.paid`
5. Restaurant onboarding wizard: connect Stripe -> set policies -> take first booking
6. Tests: webhook idempotency, Connect account state machine

**Reference:** Design doc Section 6.1. Reuse `modules/market/` Stripe Connect patterns as starting point.

#### R1-B: Booking deposit flow + manual capture lifecycle

**Files to create/edit:**
- `packages/restaurant-saas/app/r/[slug]/book/` -- diner-facing booking flow
- `packages/payments-advanced/src/deposits.ts` -- manual capture helpers
- `packages/restaurant-saas/supabase/migrations/` -- payment_intents table

**Tasks:**
1. `payment_intents` table (id, reservation_id, stripe_payment_intent_id, amount_cents, captured_cents, application_fee_cents, status, payment_method_id, customer_id, capture_method, authorized_at, captured_at, canceled_at)
2. PaymentIntent creation with `capture_method: 'manual'`, `on_behalf_of`, `transfer_data`, `application_fee_amount`
3. 7-day auth window handling; for >7d future reservations, re-authorize at T-24h via scheduled job
4. No-show capture flow: T+30min after reservation time, if not marked seated, capture deposit
5. Cancellation refund flow per policy version
6. **California SB 1524 compliance:** explicit policy disclosure + checkbox consent; store `policy_version_id`, `consent_at`, `consent_ip` on every reservation
7. `disputes` table for Stripe dispute lifecycle tracking
8. Tests: manual capture lifecycle (auth -> capture, auth -> cancel, auth -> refund), SB 1524 consent storage

#### R1-C: Embedded restaurant payments dashboard

**Files to create:**
- `packages/restaurant-saas/app/(admin)/payments/page.tsx`

**Tasks:**
1. Mount `<ConnectPayments />`, `<ConnectPayouts />`, `<ConnectAccountManagement />` using `@stripe/react-connect-js`
2. Zero custom UI for balances, taxes, disputes (Stripe handles all of it)
3. Account status indicator (onboarding, active, restricted)
4. "Stripe handles 1099-K directly" notice for US restaurants

---

## Phase R2: Floor Plan Editor

**Goal:** Restaurant builds and manages multi-area floor plan with drag-drop.
**Duration:** ~3 weeks
**Dependencies:** R0

### Prompts

#### R2-A: Floor plan editor canvas + table primitives

**Files to create:**
- `packages/restaurant-saas/app/(admin)/floor-plan/page.tsx`
- `packages/restaurant-saas/app/(admin)/floor-plan/components/Canvas.tsx`
- `packages/restaurant-saas/app/(admin)/floor-plan/components/TablePrimitive.tsx`
- `packages/restaurant-saas/app/(admin)/floor-plan/lib/floor-plan-state.ts`

**Tasks:**
1. HTML5 Canvas or SVG-based drag-drop floor plan editor
2. Table primitives: round, square, rectangle, banquette, bar, host stand
3. Snap-to-grid (8px or 16px, toggleable via toolbar)
4. Per-table metadata panel: capacity_min, capacity_max, combinable_with, server_zone, table_number
5. Table palette sidebar (drag primitives onto canvas)
6. Selection, multi-select, delete, undo/redo
7. Zoom and pan controls
8. Tests: state model (add, move, resize, delete, undo), snap-to-grid math

#### R2-B: Multi-area + saved layouts + service mode lock

**Tasks:**
1. Area tabs (Main, Patio, Bar, Private Dining) with add/rename/delete
2. Per-area table collections stored independently
3. Save named layouts (NYE, Buyout) -- snapshots all areas' table state as JSON
4. One-click layout swap with confirmation
5. Service mode lock toggle in toolbar -- prevents all drag/resize; visual indicator (lock icon, red border)
6. Default layout per day-of-week (optional)

#### R2-C: @mylife/realtime package + multi-user floor plan sync

**Files to create:**
- `packages/realtime/` -- new shared package
- `packages/realtime/src/channel.ts` -- Supabase Realtime channel helpers
- `packages/realtime/src/presence.ts` -- who's editing (cursors/avatars on floor plan)
- `packages/realtime/src/broadcast.ts` -- ephemeral events (table moves)
- `packages/realtime/src/cdc.ts` -- Postgres CDC for durable events

**Tasks:**
1. Channel subscription helpers with auto-reconnect
2. Presence API (show who's currently editing the floor plan with colored cursors)
3. Broadcast for ephemeral events (table drag in progress, before save)
4. Postgres CDC for durable events (table saved, area renamed)
5. Polling fallback for when Realtime is unavailable
6. Wire into floor plan: other users see table moves within 500ms
7. Tests: channel lifecycle, presence join/leave, broadcast delivery

---

## Phase R3: Reservation Calendar + Booking

**Goal:** Reservations flow from booking -> seated -> completed.
**Duration:** ~3 weeks
**Dependencies:** R1 + R2

### Prompts

#### R3-A: Reservation schema + RLS + CRUD with policy versioning

**Schema:**
- `reservations` (id, restaurant_id, diner_id, party_size, scheduled_at, duration_minutes, table_id, source [web_widget|mylife_app|walk_in|phone|resy_passthrough], status [pending|confirmed|seated|completed|no_show|cancelled], occasion, special_requests, dietary_notes, policy_version_id, consent_at, consent_ip, payment_intent_id, created_at, updated_at)
- `reservation_policies` (id, restaurant_id, version, cancellation_window_hrs, no_show_fee_cents, deposit_cents, deposit_per_person, policy_text, active, created_at)

**Tasks:**
1. Migrations for both tables with RLS
2. Policy CRUD with versioning (new version on edit; old bookings retain old policy)
3. Reservation CRUD with status state machine (pending -> confirmed -> seated -> completed; or -> no_show/cancelled)
4. Availability engine: given restaurant_id + date + party_size, return available time slots based on floor_tables capacity and existing reservations
5. Tests: availability calculations, status transitions, policy versioning

#### R3-B: Reservation calendar UI (day/agenda/week)

**Tasks:**
1. Day view: timeline x tables grid (default view)
2. Agenda view: chronological list for morning briefing printout
3. Week view: bird's-eye for managers
4. Color codes: blue=confirmed, yellow=arrived, green=seated, gray=closed, red=no_show
5. VIP crown badge persistent on guest name
6. Drag-to-reschedule with conflict detection
7. **Pacing visualization** (covers-per-15-min vs kitchen capacity ceiling) -- non-optional
8. Source attribution badge per booking (web, mylife, walk-in, phone)
9. "Mark Seated" / "Mark No-Show" / "Mark Completed" action buttons wired to status machine + Stripe capture/cancel

#### R3-C: Diner-facing booking page at /r/[slug]

**Files to create:**
- `packages/restaurant-saas/app/r/[slug]/page.tsx` -- public restaurant page
- `packages/restaurant-saas/app/r/[slug]/book/page.tsx` -- booking form

**Tasks:**
1. Public restaurant page: hero photo, hours, cuisines, dietary info, menu highlights
2. Availability calendar: date picker -> time slot picker -> party size
3. Booking form: name, email, phone, occasion, special requests, dietary notes
4. **Policy disclosure inline before payment** (SB 1524)
5. Required checkbox consent with stored policy_version_id + consent_at + consent_ip
6. Stripe Elements for deposit payment (if restaurant has deposits enabled)
7. Confirmation page with .ics download
8. Embeddable widget version (`/r/[slug]/widget`) for restaurant's own website
9. SEO: og:tags, structured data (Restaurant schema.org)

---

## Phase R4: Waitlist + Walk-in

**Goal:** Walk-in waitlist with two-way SMS and transparent position.
**Duration:** ~2 weeks
**Dependencies:** R3

### Prompts

#### R4-A: @mylife/sms package + Twilio integration with TCPA enforcement

**Files to create:**
- `packages/sms/` -- new shared package
- `packages/sms/src/send.ts` -- outbound SMS with TCPA window check
- `packages/sms/src/receive.ts` -- inbound webhook handler
- `packages/sms/src/consent.ts` -- opt-in/opt-out tracking
- `packages/sms/src/provisioning.ts` -- per-restaurant from-number

**Tasks:**
1. TCPA send-window enforcement: 8am-9pm in recipient's local timezone (8pm in FL)
2. Two-way conversation threading (reply routing)
3. Opt-in capture at waitlist join; opt-out via STOP keyword
4. Per-restaurant from-number provisioning (Twilio number pool)
5. Delivery receipts and bounce handling
6. Tests: TCPA window calculation across timezones, opt-in/opt-out lifecycle

#### R4-B: Walk-in waitlist + transparent position-in-line

**Schema:** `waitlist` (id, restaurant_id, diner_id, party_size, joined_at, estimated_wait_min, position, status [waiting|ready|seated|walked_away], ready_pinged_at, walked_away_reason)

**Tasks:**
1. Walk-in add flow: party size, name, phone, dietary notes, SMS opt-in
2. Quote time as range ("25-35 min") with under-promise heuristic based on historical turn times
3. SMS lifecycle: join confirmation -> ready alert -> +2 min reminder -> auto-release at +10 min no-response
4. **Transparent position-in-line** at `/r/[slug]/wait/[token]`: shows live position ("You're #4, estimated 30 min based on today's pace")
5. Walk-away swipe with three reasons (left, no-response, seated elsewhere)
6. Kitchen pacing signal: host can pause new waitlist adds when kitchen tickets back up
7. Tests: position recalculation, auto-release timing, quote accuracy

---

## Phase R5: Guest CRM

**Goal:** Restaurant maintains guest profiles with allergens, preferences, history.
**Duration:** ~2 weeks
**Dependencies:** R3

### Prompts

#### R5-A: Diner profiles + restaurant_diner_profiles + auto-tags

**Schema:**
- `diners` (id, email, phone, display_name, stripe_customer_id, default_payment_method_id, e2e_public_key, created_at, updated_at)
- `restaurant_diner_profiles` (id, restaurant_id, diner_id, visit_count, last_visit_at, lifetime_spend_cents, vip, banned, banned_reason, allergens text[], preferences jsonb, notes, auto_tags jsonb, unique(restaurant_id, diner_id))

**Tasks:**
1. Diner profile auto-built from booking history (first booking creates profile)
2. Guest list page with search, filter (VIP, allergen, visit count, spend tier)
3. Guest detail page with visit history, preferences, allergens, auto-tags
4. Allergen flagging: red badge, persistent on every surface, flows to kitchen ticket
5. Auto-tag rules with explainability: VIP (12+ visits or $200+ avg), Regular (5+), Big Spender (top 10% spend), Wine Lover (2+ wine orders)
6. Explain badge: "Tagged VIP because: 12+ visits, $200+ avg check"
7. Do-not-seat list with manager PIN to add/remove
8. **Diner sovereignty:** profile is restaurant-scoped; cross-restaurant profile only with explicit diner consent
9. Tests: profile aggregation from bookings, auto-tag evaluation, allergen surface

---

## Phase R6: Email + SMS Marketing

**Goal:** Restaurants send compliant marketing campaigns to segmented audiences.
**Duration:** ~2 weeks
**Dependencies:** R5

### Prompts

#### R6-A: Audience segmentation + restaurant-specific templates

**Schema:**
- `audiences` (id, restaurant_id, name, rules jsonb, size_cached, refreshed_at)
- `campaigns` (id, restaurant_id, name, channel [email|sms], template_id, audience_id, scheduled_at, sent_at, send_count, open_count, click_count, unsubscribe_count, status [draft|scheduled|sending|sent|failed], consent_check_passed, created_at)
- `templates` (id, restaurant_id, name, channel, subject, body_md, variables jsonb)

**Tasks:**
1. Audience builder with rule-based segments: visit_count_gte, last_visit_lt, allergen filter, vip, spend_tier
2. 7 starter templates: birthday, anniversary, win-back (>60d), post-visit thank you, event invite, slow-night fill, seasonal menu
3. Template editor with variable interpolation: `{{diner.first_name}}`, `{{reservation.time}}`, `{{restaurant.name}}`
4. **One-screen send flow:** select segment -> pick template -> preview -> send
5. Pre-flight compliance check: consent flag present, within TCPA send-window, unsubscribe link present
6. Email via Resend (with DMARC/SPF/DKIM setup wizard for custom domains)
7. SMS via `@mylife/sms` package
8. Deliverability warm-up wizard for new email domains
9. Campaign analytics: send/open/click/unsubscribe counts
10. Tests: audience evaluation against mock data, compliance check (block non-consented), template rendering

---

## Phase R7: Analytics Dashboard

**Goal:** Operator sees the numbers that matter daily.
**Duration:** ~1 week
**Dependencies:** R3 (can run parallel with R4-R6)

### Prompts

#### R7-A: Analytics dashboard with RevPASH + no-show + cohorts

**Tasks:**
1. Home tile: covers today vs same-day-last-week forecast (one number)
2. RevPASH: revenue per available seat hour (chart + trend)
3. Table turn time distribution
4. No-show rate per channel (web, phone, walk-in, mylife)
5. Server performance as cohort metrics (NOT leaderboard to avoid morale damage)
6. Day-part heatmaps (covers by hour-of-day x day-of-week)
7. Compare-to-last toggle on every chart (last week, last month, last year)
8. CSV export from every chart
9. Marketing campaign ROI (if campaigns table populated)
10. Tests: aggregation accuracy across date ranges, channel attribution correctness

---

## Phase R8: POS Integration Foundation + Square

**Goal:** Build the POS integration framework and ship the first integration.
**Duration:** ~4 weeks
**Dependencies:** R3

### Prompts

#### R8-A: @mylife/pos-adapters package + ReservationPosAdapter interface

**Files to create:**
- `packages/pos-adapters/` -- new shared package
- `packages/pos-adapters/src/types.ts` -- ReservationPosAdapter interface
- `packages/pos-adapters/src/webhook-gateway.ts` -- HMAC verification, normalized events
- `packages/pos-adapters/src/token-vault.ts` -- per-tenant OAuth token rotation
- `packages/pos-adapters/src/write-queue.ts` -- outbound writes with retry + DLQ
- `packages/pos-adapters/src/reconciliation.ts` -- daily diff job

**Tasks:**
1. `ReservationPosAdapter` interface: `getAvailability`, `createReservation`, `updateReservation`, `markSeated`, `cancel`
2. Webhook gateway with HMAC verification per provider, normalizes to canonical event schema
3. Token vault with per-tenant rotation and location-scoped access
4. Outbound write queue with retry (exponential backoff, 3 retries) + dead letter queue
5. Reconciliation job runner: daily diff between local state and POS read API to repair webhook drops
6. `pos_connections` table (provider, account_id, location_id, tokens, scopes, status, last_sync_at)
7. `pos_sync_log` table (connection_id, direction, entity, payload, ack_status, error)
8. Tests: adapter interface contract tests, webhook idempotency, reconciliation accuracy

#### R8-B: Square Bookings adapter (V1 of POS layer)

**Tasks:**
1. OAuth 2.0 flow with `APPOINTMENTS_READ` + `APPOINTMENTS_WRITE` scopes
2. Map Square Bookings API (appointment-shaped) to table semantics
3. `searchAvailability` -> `createReservation` -> `markSeated` -> complete/cancel
4. Webhook receiver for `booking.created`, `booking.updated`
5. Bidirectional sync: booking in MyLife appears in Square within 10s; booking in Square appears in MyLife within 10s
6. Submit Square App Marketplace listing
7. Tests: adapter contract against Square sandbox, bidirectional sync

---

## Phase R9: Toast POS Adapter

**Goal:** Toast integration despite no native reservations API.
**Duration:** ~3 weeks (gated by Toast partner approval, 3-4 weeks lead time)
**Dependencies:** R8

### Prompts

#### R9-A: Toast adapter (reservation-as-order modeling)

**Tasks:**
1. File Toast Partner Application early in R8 (3-4 week approval window)
2. Reservation -> Toast order with metadata: party_size, time_slot, dietary_notes as order properties
3. Service hours from Toast restaurants API
4. Webhook integration for order state changes (created, in-progress, completed, voided)
5. Handle Toast's 1000 req/min/location rate limit with queue throttling
6. Tests: order modeling correctness, rate limit handling, state sync

---

## Phase R10: Lightspeed K-Series Adapter + Production Ops

**Goal:** Best POS API integration + production ops posture.
**Duration:** ~3 weeks (gated by Lightspeed partner approval)
**Dependencies:** R8

### Prompts

#### R10-A: Lightspeed K-Series adapter + deposit flow

**Tasks:**
1. File Lightspeed Technical Partner Manager request early in R8
2. Lightspeed K-Series adapter: cleanest API with native reservation + deposit primitives
3. Deposits flow directly into POS as payment (unique to Lightspeed)
4. OAuth 2.0 client_credentials authentication
5. Rich webhook integration
6. Tests: adapter contract, deposit-to-POS flow

#### R10-B: @mylife/audit-log package + production ops tooling

**Files to create:**
- `packages/audit-log/` -- new shared package

**Tasks:**
1. `audit_events` table: actor_user_id, action, entity, entity_id, old_value jsonb, new_value jsonb, ip, user_agent, created_at
2. Append-only enforcement at DB level (no UPDATE, no DELETE via RLS)
3. Query API for compliance investigation
4. Retention policy: configurable per restaurant, default 7 years
5. GDPR handling: anonymize actor on deletion request, retain event structure
6. Status page live at status.mylife.app (Statuspage.io)
7. PagerDuty integration with on-call rotation
8. Sentry error tracking + Real User Monitoring
9. Datadog or Grafana Cloud for infrastructure metrics
10. Document top 20 runbooks for failure modes
11. Tests: audit log capture, append-only enforcement, retention

---

## Phase R11: Clover + Omnivore (75% US Coverage)

**Goal:** Top-5 POS coverage (~75% of US restaurants).
**Duration:** ~3 weeks
**Dependencies:** R10

### Prompts

#### R11-A: Clover adapter + App Market submission

**Tasks:**
1. Clover REST API adapter implementing ReservationPosAdapter
2. Optional Android device app for staff UX (if budget/time allows)
3. Submit Clover App Market listing (4-6 week review period)
4. Plan for 30% rev share on Clover marketplace distribution
5. Tests: adapter contract against Clover sandbox

#### R11-B: Omnivore proxy adapter (Aloha + Brink + Micros enterprise)

**Tasks:**
1. Integrate Omnivore (Olo) middleware -- single adapter abstracting enterprise POSes
2. Omnivore subscription terms negotiation
3. Map Omnivore's unified API to ReservationPosAdapter interface
4. Handle Aloha, Brink, Micros differences via Omnivore's normalization layer
5. Tests: adapter contract, error handling when Omnivore is down

---

## Phase R12: Differentiator Features + AI

**Goal:** Ship wedge features no incumbent will build because they conflict with their business model.
**Duration:** ~4 weeks
**Dependencies:** R11

### Prompts

#### R12-A: AI floor plan from photo

**Tasks:**
1. Computer vision integration (Claude Vision or OpenAI Vision API)
2. Operator uploads phone photo of dining room
3. Model identifies table positions, shapes, and approximate capacities
4. Propose table primitives overlaid on the photo
5. Operator confirms/edits proposed layout -> saved to floor_tables
6. Tests: primitive detection accuracy on 10+ sample photos

#### R12-B: Predictive walk-in surge + server zone heatmap

**Tasks:**
1. Walk-in surge predictor: weather API + day-of-week + neighborhood event signals
2. Predict next-30-min walk-in probability as percentage bar
3. Server zone heatmap: real-time check-touch latency overlaid on floor plan
4. Color gradient from green (responsive) to red (overloaded)
5. Tests: surge prediction with mock weather data, heatmap rendering

#### R12-C: Allergen-aware kitchen alerts + sustainability filters + data export

**Tasks:**
1. Auto-print prep alerts to kitchen for every reservation with dietary notes (printer integration or PDF generation)
2. Kitchen display screen at `/r/[slug]/kitchen` showing upcoming allergen alerts
3. Sustainability/dietary discovery filters: woman-owned, BIPOC-owned, farm-direct, zero-waste, vegan-first, halal, gluten-free (as restaurant self-declared tags)
4. Filter surface on diner-facing booking pages
5. Diner-owned data export: JSON/CSV of all reservations, preferences, history at `/account/export`
6. Tests: alert generation, filter accuracy, export completeness

---

## Phase R13: NYC Beachhead Acquisition

**Goal:** First 50-100 NYC restaurants live by Month 18.
**Duration:** 4-6 months (overlapping with R10-R12)
**Dependencies:** R3 at minimum (functional booking system)

### Tasks (founder-led, not engineering-heavy)

1. **Founder-led pitches:** Visit indie restaurants in NYC neighborhoods (LES, West Village, Williamsburg, Carroll Gardens, Bushwick)
2. **Target profile:** Independent, 30-80 seats, frustrated with OpenTable/Resy pricing, values privacy narrative
3. **Onboarding support:** Side-by-side setup (<60 minutes per restaurant per design doc)
4. **First-week support:** Daily check-in with first 10 restaurants
5. **Press cycle:** TechCrunch, The Verge, 404 Media, Eater, Grub Street -- timed to incumbent stumbles (pricing hikes, data breaches, merger friction)
6. **Creator outreach:** Aligned food influencers get free Pro for their featured restaurants
7. **Community presence:** r/foodNYC, r/AskNYC, r/FoodPros, Mastodon food communities

### Milestones

| Target | Month |
|--------|-------|
| First 10 restaurants live (founder-sideloaded) | 15 |
| First 50 restaurants live | 17 |
| First 100 restaurants + first city hire | 18 |
| NYC 200+ restaurants; LA expansion start | 21 |
| NYC + LA + SF + Chicago: 500+ restaurants | 27 |

### Success Metrics
- Average restaurant: 30+ MyLife-attributed reservations/month
- Net revenue per restaurant: ~$199/mo ($99 sub + ~100 bookings)
- Restaurant NPS > 50
- Onboarding completion rate > 70%
- Time-to-first-reservation < 60 min for self-serve
- 2-3 tier-1 press placements

---

## Compliance Checklist (enforced across all R-phases)

| Requirement | Phase | Implementation |
|-------------|-------|----------------|
| PCI DSS SAQ A | R1 | Stripe Connect Standard + Stripe.js + Elements; never touch PAN/CVV |
| California SB 1524 | R1/R3 | Policy disclosure + checkbox consent + stored policy_version_id + consent_at + consent_ip |
| TCPA | R4/R6 | Send-window enforcement (8am-9pm local); separate SMS consent |
| CAN-SPAM | R6 | Unsubscribe link in every email; separate email consent |
| Multi-tenant RLS | R0+ | restaurant_id on every table; RLS policies; pen-test before GA |
| GDPR (future) | R10 | Audit log anonymization; diner self-serve export + deletion |
| 1099-K | R1 | Stripe issues directly to restaurants on Standard accounts |

---

## Verification Commands (Per Phase)

```bash
cd packages/restaurant-saas && pnpm typecheck     # TypeScript clean
cd packages/restaurant-saas && pnpm test           # All tests pass
cd packages/restaurant-saas && pnpm build          # Production build succeeds
cd packages/payments-advanced && pnpm test         # Payment tests pass
cd packages/realtime && pnpm test                  # Realtime tests pass
cd packages/sms && pnpm test                       # SMS tests pass
cd packages/pos-adapters && pnpm test              # POS adapter tests pass
cd packages/audit-log && pnpm test                 # Audit log tests pass
```

---

## Agent Team Composition (for orchestrated builds)

| Agent | Owns | Phase(s) |
|-------|------|----------|
| `saas-core` | `packages/restaurant-saas/app/`, Supabase schema, admin pages | R0, R3, R4-B, R5, R6, R7, R12-C, R13 |
| `payments-dev` | `packages/payments-advanced/`, Stripe Connect, webhooks | R1 |
| `floor-plan-dev` | Floor plan editor, canvas, realtime | R2 |
| `realtime-dev` | `packages/realtime/` | R2-C |
| `sms-dev` | `packages/sms/`, Twilio | R4-A |
| `pos-dev` | `packages/pos-adapters/`, all POS adapters | R8, R9, R10-A, R11 |
| `ops-dev` | `packages/audit-log/`, status page, PagerDuty, monitoring | R10-B |
| `ai-dev` | CV floor plan, surge predictor, heatmap | R12-A, R12-B |
| `admin-ui-dev` | `packages/admin-ui/`, shared components | R0+ (incremental) |
| `test-writer` | Tests across all packages | All phases |

**File ownership prevents conflicts.** Each agent owns specific directories. The orchestrator (main session) coordinates sequencing and validates acceptance criteria.

---

## Reference Documents

| Document | Path |
|----------|------|
| Production design doc | `docs/plans/modules/restaurant-platform-design-2026-04-20.md` |
| Implementation plan | `docs/plans/queue/07-restaurant-platform-implementation.md` |
| Original dining design | `docs/plans/modules/dining-module-design-doc-2026-04-19.md` |
| Canonical mission control | `docs/plans/restaurant-saas-r0-r13-mission-control.md` |
| Consumer dining handoff | `docs/sessions/2026-04-20-dining-module-handoff.md` |
| Dining module CLAUDE.md | `modules/dining/CLAUDE.md` |
| Investor pitch context | `docs/plans/investor-pitch/session-summary-2026-04-19.md` |
