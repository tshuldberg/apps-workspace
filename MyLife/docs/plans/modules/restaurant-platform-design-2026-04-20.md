# MyLife Restaurant Platform — Production Design Document
**Date:** 2026-04-20
**Status:** Production-grade design, ready for phased build
**Scope:** Consumer Dining module (Year 1) + Restaurant Reservations SaaS (Year 2-3)
**Companion files:**
- Implementation plan: `/docs/plans/queue/07-restaurant-platform-implementation.md`
- Mission Control: `/docs/plans/restaurant-saas-r0-r13-mission-control.md`
- Prior research: `/docs/plans/modules/dining-module-design-doc-2026-04-19.md`
- Funding strategy: `/docs/plans/investor-pitch/session-summary-2026-04-19.md`

---

## 1. Executive Summary

This document defines a production-grade plan to ship a complete restaurant platform across two product surfaces:

1. **Consumer Dining module** (`modules/dining/`) — privacy-first dining log + wishlist + reservation tracking + deep-link booking + cross-module integration. Ships in MyLife Hub at $12/yr Pro tier as module #31. **Year 1.**
2. **Restaurant Reservations SaaS** (`packages/restaurant-saas/`) — full operator platform: floor plan, waitlist, guest CRM, marketing automation, analytics, deposit/no-show payments via Stripe Connect, POS integrations with Square + Toast + Lightspeed + Clover. Ships as a separate package with hosted offering at $99/mo + $1/booking. **Year 2-3.**

The two surfaces are designed to interoperate but ship as separate products with distinct codebases, distinct customers, distinct release cadences, and distinct ops postures. The architecture review made clear that forcing the restaurant SaaS into the consumer module registry would break both products.

**Strategic position:** four players control 50%+ of the restaurant reservation market (OpenTable 32%, Resy+Tock combined ~50% post-merger, SevenRooms 7%, Yelp <5%). Three are now owned by hyperscale extractive parents (Booking, Amex, DoorDash). Our entry is positioned on **price (50-80% under all of them), privacy (the diner owns their data), and mission lock (PBC + bylaw price ceiling)** — three dimensions none of the incumbents can match without dismantling their business models.

**MVP timelines (AI-amplified casual building):**
- Consumer Dining module P0-P6: **8-16 weeks** of casual building
- Restaurant SaaS MVP (single-region, Stripe Connect, no POS integrations): **3-6 weeks** focused
- POS integrations (Square, Toast, Lightspeed, Clover): **6 months** including partner-application calendar time
- Full launch readiness with production ops posture: **12-18 months from start**

---

## 2. Strategic Context

### 2.1 The competitive map (April 2026)

| Platform | Owner | Restaurants | Diner side | Operator side | Pricing |
|----------|-------|-------------|------------|---------------|---------|
| OpenTable | Booking Holdings | 65,000+ global | Reviews, AI Concierge (July 2025), Regulars loyalty (relaunched 2025) | GuestCenter | $149-499/mo + $0.25-1.50/cover |
| Resy + Tock (merging Summer 2026) | American Express | ~25,000 post-merger | Hit List, Notify, Priority Notify (Amex perk), Global Dining Access | ResyOS | $249-899/mo, no per-cover fee |
| SevenRooms | DoorDash (June 2025, $1.2B) | 13,000+ (hospitality skew) | None standalone (restaurant-direct booking) | Best CRM, AI suite (Mar 2025) | $499+/mo, commission-free |
| Yelp Reservations | Yelp | smaller | Limited | Light | Free tier + paid |
| TheFork | TripAdvisor | EU-leader | Standard | Standard | Per-cover |

### 2.2 Identified market gaps

The competitor research surfaced ten user complaints that no incumbent has solved:

1. No social/friend layer
2. No cross-platform single inbox
3. Group coordination tools are bad everywhere
4. Dietary preferences don't follow you between platforms
5. Notify/waitlist positions are black boxes
6. Marketing tools locked to top tiers (indie restaurants priced out)
7. Privacy is opaque (cross-restaurant profiling)
8. AI Concierge knows only one platform (siloed)
9. No bill-split / pay-at-table standard
10. Sustainability/dietary discovery is poor

These gaps form our differentiation surface.

### 2.3 Our positioning

| Lever | MyLife position | Why incumbents can't match |
|-------|-----------------|----------------------------|
| **Price** | $99/mo flat + $1/booking, no per-cover | OpenTable/Tock/Resy can't drop without nuking their cash cow |
| **Privacy** | Diner owns data, E2E encrypted preferences, exportable | Their business model is data extraction |
| **Mission lock** | PBC charter, founder supermajority, bylaw price ceiling | Their cap table requires extraction |
| **Aesthetic** | Cool Obsidian dark theme; warm, candlelit | Toast/Square/OT inherited 90s grocery POS aesthetic |
| **AI surface** | Cross-platform Concierge (search ALL of OpenTable/Resy/Tock + walk-in) | They each see only their own inventory |
| **Diner sovereignty** | Portable JSON-exportable profile + history | Their CRM is restaurant-owned, not diner-owned |
| **Group dining** | Friend graph, polling, group bookings, bill-split | None has tackled this |

---

## 3. Product Architecture

### 3.1 Two products, one ecosystem

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MyLife Hub ($12/yr)                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Dining Module (modules/dining/)                              │   │
│  │  - Restaurant wishlist                                        │   │
│  │  - Visit log, photos, dishes, wines                           │   │
│  │  - Cross-module: recipes, nutrition, budget, RSVP, mood       │   │
│  │  - Local-first SQLite (dn_ prefix)                            │   │
│  │  - Deep-link to ANY booking platform                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ Booking handoff via:
                                  │   1. MyLife Reservations protocol
                                  │   2. Resy/OpenTable deep-link
                                  │   3. Restaurant website
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MyLife Reservations SaaS ($99/mo + $1/booking)           │
│              (packages/restaurant-saas/, separate Next.js app)        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Restaurant operator surface                                  │   │
│  │  - Floor plan + waitlist + reservation calendar               │   │
│  │  - Guest CRM with allergen/preference tracking                │   │
│  │  - Email + SMS marketing automation                           │   │
│  │  - Stripe Connect for deposits/no-shows                       │   │
│  │  - POS integrations: Square, Toast, Lightspeed, Clover        │   │
│  │  - Multi-tenant (restaurant_id) Postgres + RLS                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Diner-facing booking surface                                 │   │
│  │  - Restaurant pages on reservations.mylife.app                │   │
│  │  - Or rendered inside MyLife Dining module                    │   │
│  │  - Or embedded widget on restaurant's own site                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Why two products, not one

The architecture review surfaced the critical decision: **the module registry is built for consumer features that users enable/disable on their own data; restaurants are external customers with subscriptions, multi-tenant data, role-based access, B2B sales motion, and 24/7 ops requirements.** Forcing the restaurant SaaS into the registry would corrupt the consumer architecture and underdeliver on the restaurant side.

Reasons the restaurant SaaS is a separate package:
- Multi-tenancy (RLS by `restaurant_id`) is alien to MyLife's user-owned-SQLite model
- Admin dashboards need app-level routes with role-based access, not module tabs
- Production ops posture (status pages, on-call, 99.9% SLA) doesn't apply to consumer modules
- Revenue model is fundamentally different ($99/mo SaaS vs $12/yr consumer)
- Engineering/ops cadences will diverge

The two products communicate through:
1. **MyLife Reservations Protocol** (open API spec — design in Phase 8)
2. Standard deep-link URL schemes for cross-platform booking
3. Eventual federation if we choose to open-source the protocol (Section 11)

---

## 4. Consumer Dining Module Spec

This section is summarized; full detail in `dining-module-design-doc-2026-04-19.md`. Key updates from this session's research:

### 4.1 Updated module identity

| Attribute | Value |
|-----------|-------|
| Module ID | `dining` |
| Display name | MyDining (final decision pending; alternatives: Plates, Table, Menu) |
| Table prefix | `dn_` |
| Storage type | SQLite (local-first) |
| Tier | Pro ($12/yr) |
| Module count after addition | **31** |
| Mobile + Web | Yes, parity required |
| Cloud-backed components | None at launch (everything local) |
| Accent color | **`#DC2626` warm restaurant red** + `#EF4444` light (final, per mission control conventions) |

### 4.2 Phase plan (P0-P7)

P0 Foundation → P1 Restaurant Manager → P2 Visit Log + Photos → P3 Dish Tracking → P4 Wishlist + Watchlist → P5 Reservation Tracking + Deep Links → P6 Cross-Module Integration → P7 Advanced (wines, year-in-review, AI Concierge)

**P7 addition based on research:** AI Concierge that meta-searches across OpenTable, Resy, and Tock public data + the user's MyLife wishlist + walk-in availability. This is the "no incumbent will ever build this because it shows their competitors" wedge.

### 4.3 New cross-module integration: MyLife Reservations Protocol bridge

When restaurants are on the MyLife Reservations SaaS (Year 2+), the Dining module's "Book" button instant-books through our own platform instead of deep-linking out. Falls back to Resy/OpenTable deep-link for non-MyLife restaurants. This is the slow-burn closed-loop: every diner using MyLife is a marketing surface to the next restaurant.

---

## 5. Restaurant Reservations SaaS Spec

### 5.1 Architecture

**Package:** `packages/restaurant-saas/` (separate from `modules/dining/`)
**Stack:** Next.js 15 (App Router) + Supabase Postgres + Stripe Connect + Twilio SMS + Mapbox + Resend (email)
**Multi-tenancy:** Single Supabase project, single shared schema, `restaurant_id` on every table, RLS policies per role
**Hosting:** Vercel for app + Supabase managed Postgres + Cloudflare R2 for photo storage

### 5.2 Data model (canonical schema)

```sql
-- Restaurant identity
restaurants (
  id uuid pk,
  slug text unique,
  legal_name text,
  display_name text,
  stripe_account_id text,
  charges_enabled bool,
  payouts_enabled bool,
  country char(2),
  timezone text,
  cuisines text[],
  price_tier int,
  hours jsonb,           -- per-day-of-week
  policies jsonb,        -- cancellation, deposit, dress, age
  branding jsonb,        -- logo, colors, hero photos
  capabilities jsonb,    -- pos_provider, pos_account_id, marketing_consent
  status text,           -- onboarding | active | paused | terminated
  created_at, updated_at
)

restaurant_users (        -- staff
  id uuid pk,
  restaurant_id uuid fk,
  user_id uuid fk auth.users,
  role text,             -- owner | manager | host | server | marketing
  can_manage_billing bool,
  can_manage_staff bool,
  invited_at, accepted_at
)

-- Floor plan
floor_areas (
  id uuid pk, restaurant_id uuid fk, name text,    -- "Main", "Patio"
  display_order int, active bool
)

floor_tables (
  id uuid pk, area_id uuid fk,
  shape text,            -- round | square | rectangle | banquette | bar
  pos_x int, pos_y int, width int, height int, rotation int,
  capacity_min int, capacity_max int,
  combinable_with uuid[],
  server_zone text,
  table_number text,
  active bool
)

floor_layouts (           -- saved layouts (e.g., "NYE")
  id uuid pk, restaurant_id uuid fk, name text,
  snapshot jsonb         -- entire floor_areas + floor_tables state
)

-- Reservations
reservations (
  id uuid pk,
  restaurant_id uuid fk,
  diner_id uuid fk diners,
  party_size int,
  scheduled_at timestamptz,
  duration_minutes int,
  table_id uuid fk floor_tables,
  source text,           -- web_widget | mylife_app | walk_in | phone | resy_passthrough
  status text,           -- pending | confirmed | seated | completed | no_show | cancelled
  occasion text,
  special_requests text,
  dietary_notes text,
  policy_version_id uuid fk reservation_policies,
  consent_at timestamptz, -- SB 1524 compliance
  consent_ip text,
  payment_intent_id uuid fk payment_intents,
  created_at, updated_at
)

waitlist (
  id uuid pk, restaurant_id uuid fk, diner_id uuid fk,
  party_size int, joined_at timestamptz,
  estimated_wait_min int, position int,
  status text, -- waiting | ready | seated | walked_away
  ready_pinged_at timestamptz, walked_away_reason text
)

reservation_policies (
  id uuid pk, restaurant_id uuid fk,
  version int,
  cancellation_window_hrs int,
  no_show_fee_cents int,
  deposit_cents int, deposit_per_person bool,
  policy_text text,      -- legal copy shown to diners
  active bool, created_at
)

-- Diner CRM
diners (
  id uuid pk,
  email text unique,
  phone text,
  display_name text,
  stripe_customer_id text,
  default_payment_method_id text,
  e2e_public_key text,   -- for portable preferences
  created_at, updated_at
)

restaurant_diner_profiles ( -- restaurant's view of a diner
  id uuid pk, restaurant_id uuid fk, diner_id uuid fk,
  visit_count int, last_visit_at timestamptz,
  lifetime_spend_cents bigint,
  vip bool, banned bool, banned_reason text,
  allergens text[], preferences jsonb, notes text,
  auto_tags jsonb,       -- {tag, reason, scored_at}
  unique(restaurant_id, diner_id)
)

-- Marketing
audiences (
  id uuid pk, restaurant_id uuid fk, name text,
  rules jsonb,           -- {visit_count_gte: 5, last_visit_lt: '90d ago'}
  size_cached int, refreshed_at timestamptz
)

campaigns (
  id uuid pk, restaurant_id uuid fk, name text,
  channel text,          -- email | sms
  template_id uuid fk templates,
  audience_id uuid fk audiences,
  scheduled_at timestamptz, sent_at timestamptz,
  send_count int, open_count int, click_count int, unsubscribe_count int,
  status text,           -- draft | scheduled | sending | sent | failed
  consent_check_passed bool,
  created_at
)

templates (
  id uuid pk, restaurant_id uuid fk, name text,
  channel text, subject text, body_md text,
  variables jsonb        -- {{diner.first_name}}, {{reservation.time}}
)

-- Payments
payment_intents (
  id uuid pk, reservation_id uuid fk,
  stripe_payment_intent_id text unique,
  amount_cents int, captured_cents int,
  application_fee_cents int,
  status text, payment_method_id text, customer_id text,
  capture_method text,   -- manual (auth+capture)
  authorized_at timestamptz, captured_at timestamptz, canceled_at timestamptz
)

webhook_events (          -- Stripe + POS webhooks; idempotency
  id uuid pk,
  source text,           -- stripe | square | toast | lightspeed | clover
  event_id text unique,
  event_type text, payload jsonb,
  processed_at timestamptz, error text, retry_count int
)

disputes (
  id uuid pk, payment_intent_id uuid fk,
  stripe_dispute_id text, status text,
  amount_cents int, reason text,
  evidence jsonb, evidence_due_at timestamptz,
  outcome text, resolved_at timestamptz
)

-- POS integrations
pos_connections (
  id uuid pk, restaurant_id uuid fk,
  provider text,         -- square | toast | lightspeed_k | lightspeed_u | clover | omnivore
  account_id text, location_id text,
  oauth_access_token text, oauth_refresh_token text,
  token_expires_at timestamptz,
  scopes text[], status text,
  last_sync_at timestamptz, sync_error text
)

pos_sync_log (
  id uuid pk, connection_id uuid fk,
  direction text,        -- inbound | outbound
  entity text, entity_id text,
  payload jsonb, ack_status text, error text,
  created_at
)

-- Audit
audit_events (
  id uuid pk,
  restaurant_id uuid fk,
  actor_user_id uuid,
  action text,           -- e.g., reservation.created, diner.updated, payment.captured
  entity text, entity_id uuid,
  old_value jsonb, new_value jsonb,
  ip text, user_agent text,
  created_at
)
```

**Schema rationale:** Restaurant CRM is shallower than SevenRooms intentionally — diner sovereignty is the wedge. We do not want a giant cross-restaurant guest profile; restaurants get only what diners explicitly share at booking time.

### 5.3 Feature inventory

#### A. Floor plan editor
- Drag-drop primitives: round / square / rectangle / banquette / bar / host stand
- Snap-to-grid (8px or 16px, toggleable)
- Multi-area tabs (Main, Patio, Bar, Private Dining)
- Capacity min/max per table; combinable_with
- Server zones overlay
- Saved named layouts (NYE, Buyout)
- Service mode lock (no accidental drags during dinner rush)
- Real-time multi-user updates (<500ms via Supabase Realtime)
- **Innovation: AI floor plan from photo** — operator uploads dining-room photo; CV model proposes table primitives; operator confirms/edits

#### B. Reservation calendar
- Day view (timeline × tables grid) default
- Agenda view for morning briefing
- Week view for managers
- Color codes: party size heat ramp, status (blue=confirmed, yellow=arrived, green=seated, gray=closed, red=no-show)
- VIP crown badge persistent
- Drag-to-reschedule with conflict detection
- **Pacing visualization** (covers-per-15-min vs kitchen capacity ceiling) — non-optional
- Source attribution per booking

#### C. Walk-in / waitlist
- Quote time as range ("25-35 min") — under-promise
- Two-way SMS thread: join confirmation → ready alert → +2 min reminder → auto-release at +10 min
- Walk-away swipe with three reasons (left, no-response, seated elsewhere)
- Kitchen pacing signal so host can pause new adds when tickets back up
- **Transparent position-in-line in diner-facing view** ("you're #4, ETA 30min based on history") — no incumbent does this

#### D. Guest CRM (deliberately shallower than SevenRooms)
- Profile: visit count, last visit, lifetime spend (when POS-attributed), allergens (red, persistent, on kitchen ticket), preferences (free text + structured)
- Auto-tags (VIP, Regular, Big Spender, Wine Lover) — **explainable** ("Tagged VIP because: 12+ visits, $200+ avg check")
- Do-not-seat list requires manager PIN to remove
- VIP, allergen, and preferences flow to kitchen ticket auto-print
- **Diner sovereignty:** restaurant CRM is what the diner shared at booking; cross-restaurant profile only with explicit consent

#### E. Email + SMS marketing
- Triggered automations (birthday, anniversary, win-back, post-visit feedback)
- Segments out of the box (last visit > 60 days, > 5 visits, never visited, allergen filter)
- Restaurant-specific templates, not generic email-builder
- **One-screen send flow** (segment + template + send) — no campaign canvas
- Compliance: TCPA send-window enforcement (8am-9pm local), CAN-SPAM unsubscribe, separate email/SMS consent capture, deliverability warm-up wizard for new domains, DMARC/SPF setup at onboarding

#### F. Analytics
- Home tile: covers vs forecast (one number that matters today)
- RevPASH (revenue per available seat hour)
- Table turn time
- No-show rate (per channel: web/phone/walk-in)
- Server performance (cohort, not leaderboard — avoid morale damage)
- Day-part heatmaps
- Compare-to-last toggle on every chart
- CSV export from every chart

#### G. Stripe Connect payments
- Standard accounts via Embedded Onboarding components
- Destination charges with `on_behalf_of`
- Manual-capture PaymentIntents for deposits (7-day auth window; >7d future = re-authorize T-24h)
- No-show capture flow (T+30min after reservation if not seated)
- Cancellation refund flow per policy version
- **California SB 1524 compliance:** explicit policy disclosure + checkbox consent + stored policy_version_id + consent timestamp
- Embedded restaurant dashboard (`<ConnectPayments />`, `<ConnectPayouts />`, `<ConnectAccountManagement />`) — zero custom UI for balances, taxes, disputes
- 1099-K issued by Stripe directly to restaurant on Standard accounts (we don't)

#### H. POS integrations
- `ReservationPosAdapter` interface: `getAvailability`, `createReservation`, `updateReservation`, `markSeated`, `cancel`
- Per-POS adapters behind the interface
- Token vault with per-tenant rotation
- Webhook gateway with HMAC verification, normalizes to canonical event schema
- Outbound write queue with retry + DLQ
- Daily reconciliation jobs (poll POS read API to repair webhook drops)

**Integration sequence (6-month plan):**
1. **Square** (Bookings API) — fastest, no approval gate, build table semantics on top of appointment-shaped API
2. **Toast** — largest US POS (despite Resy preferred-partner status); model reservations as orders with metadata
3. **Lightspeed K-Series** — best reservation primitives, partner-relationship-paced
4. **Clover** — App Market submission, 4-6 week review, 30% rev share for marketplace distribution
5. **Omnivore (Olo)** as paid shortcut for Aloha/Brink/Micros without dedicated engineering
6. **Lightspeed U-Series (Upserve)** — US legacy account coverage (deferred past initial launch; evaluate demand from first cohort)

**Explicitly NOT integrated (competitive blockers):**
- Resy / OpenTable / TouchBistro — they sell competing reservations, will refuse partnership

#### I. Hardware (BYOD strategy)
We do **not** sell hardware. We publish certified configurations:
- Host stand: iPad Pro 12.9" + Square Stand 2nd Gen ($149) for card reader, or unbranded Heckler stand
- Server handheld: iPhone 13+ in Mophie battery case, or Samsung Galaxy Tab Active 3 for spill-prone kitchens (glove + IP54)
- Kitchen display: 22" Elo touchscreen wall-mount
- Receipt printer: Star TSP100 + APG Vasario cash drawer

**Selling hardware is a Toast trap** — capital-intensive, lock-in-perceived, anti-mission. BYOD is a differentiator.

#### J. Onboarding (target <60 minutes)
1. Sign up + Google Business Profile import (3 min): name, address, hours, hero photos auto-pulled
2. Floor plan from template (10 min): pick starter (40/60/80-seat) or AI-from-photo
3. Reservation policies (5 min): party range, advance window, deposit/cancellation defaults
4. Stripe Connect onboarding (10 min): KYC runs in background; restaurant goes live with deferred payment capability
5. Menu CSV upload or POS sync (15 min): or skip with "I'll do this later" banner
6. Invite staff + role assignment (5 min)
7. Take your first reservation (2 min): guided demo booking; confetti; live

**Total: 50 min worst case. OpenTable benchmark is 4 hours. We crush by 4-5x.**

### 5.4 Pricing model

**Flat pricing:** $99/mo subscription + $1.00 per completed reservation (zero fee on free seatings or cancellations). Single plan, all features included. Tiered pricing (indie/enterprise) may be introduced later based on market feedback.

**Compare:**
- OpenTable: $149-499/mo + $0.25-1.50/cover
- Resy OS: $249-899/mo
- Tock: $79-769/mo + 2% prepayment processing
- SevenRooms: $499+/mo

We are **50-80% cheaper than every incumbent**, with zero per-cover fees, and full marketing automation included at $99/mo (currently locked behind $499+/mo Pro elsewhere).

### 5.5 Differentiator features (strategic wedges)

These are features no incumbent will build because they conflict with the incumbent's business model:

1. **Portable diner profile** — diner owns dietary, allergen, preference profile; E2E encrypted; restaurant only receives what diner explicitly shares per booking; purgeable post-visit
2. **Cross-platform AI Concierge** — Dining module's AI searches MyLife + Resy + OpenTable + Tock + walk-in availability; the meta-layer none of them will build
3. **Friend graph + group polling** — Doodle-style "let's eat" with availability collision and instant booking (deferred past initial launch; requires social identity layer not yet built)
4. **Transparent waitlist position** — kills the Notify black box
5. **AI floor plan from photo** — onboarding shortcut; computer vision generates table primitives from a phone snap
6. **Allergen-aware kitchen alerts** — system pre-prints prep alerts to kitchen for every reservation with dietary notes
7. **Predictive walk-in surge window** — weather + day + neighborhood signals
8. **Server zone heatmap** — real-time check-touch latency overlaid on floor plan
9. **One-screen marketing** — segment + template + send, no campaign canvas
10. **Bill-split + tip-fairness** at-table without POS lock-in
11. **Group dining receipts** to shared expense view (Splitwise-grade)
12. **Sustainability/dietary discovery filters** — woman-owned, BIPOC-owned, farm-direct, zero-waste, vegan-first, halal, gluten-free first-class
13. **Diner-owned data export** — JSON/CSV of all visits, preferences, history, anytime

---

## 6. Required New Shared Packages

Per the architecture review, the restaurant SaaS depends on six new shared packages that don't exist in MyLife today. Build order:

### 6.1 `@mylife/payments-advanced`
Wraps `@mylife/subscription`'s Stripe client with restaurant-specific logic:
- Connect onboarding via Embedded Components
- Manual-capture PI lifecycle (auth → capture → cancel → refund)
- Application fee mechanics (`application_fee_amount` on destination charges)
- Webhook receiver with idempotency table
- Dispute response evidence packaging
- 1099-K downstream queries (read-only)

**Reuses:** Market module's `payments/stripe-connect.ts` and `orchestrator.ts` as starting point.

### 6.2 `@mylife/realtime`
Abstracts Supabase Realtime with polling fallback:
- Channel subscription helpers
- Presence (who's currently editing the floor plan)
- Broadcast for ephemeral events (table moves)
- Postgres CDC for durable events (reservations, payments)
- Polling fallback for offline mobile

### 6.3 `@mylife/sms`
Twilio integration:
- Outbound SMS with TCPA send-window enforcement (8am-9pm local timezone of diner)
- Two-way conversation threads (reservation modifications, waitlist)
- Opt-in/opt-out tracking
- Per-restaurant from-number provisioning
- Delivery receipts and bounce handling

### 6.4 `@mylife/audit-log`
Immutable event log:
- `audit_events` table with actor, action, entity, old_value, new_value, IP, user-agent
- Append-only enforcement at DB level
- Query API for compliance/investigation
- Retention policy (configurable per restaurant; default 7 years)
- GDPR data deletion handling

### 6.5 `@mylife/admin-ui`
Shared React components for role-based dashboards. Built incrementally starting in R0; core components land as R0-R3 admin pages need them.
- Permission guard wrapper components
- Tables with sorting, filtering, pagination, bulk actions
- Form patterns (multi-step wizards, inline edit)
- Modal/dialog patterns
- Status badges, timeline components
- Cool Obsidian theme tokens applied

### 6.6 `@mylife/pos-adapters`
The `ReservationPosAdapter` interface and per-POS implementations:
- Square Bookings adapter
- Toast (reservation-as-order) adapter
- Lightspeed K-Series adapter
- Lightspeed U-Series (Upserve) adapter (deferred past initial launch)
- Clover adapter
- Omnivore (Olo) adapter for Aloha/Brink/Micros
- Webhook gateway
- Token vault
- Outbound write queue with retry + DLQ
- Reconciliation job runner

---

## 7. Production Operations Posture

The single biggest gap surfaced by the architecture review is that MyLife has consumer-app ops posture, not restaurant-grade ops posture. Restaurant SaaS requires:

| Layer | Tool | Cost | Required by |
|-------|------|------|-------------|
| Status page | Statuspage.io | $5K/yr | Public commitment to restaurants |
| Incident management | PagerDuty | $5-15K/yr | 24/7 on-call coverage |
| Runbooks | Rootly or Notion | $3K/yr | Sev1+ playbooks |
| Application monitoring | Sentry | $5-15K/yr | Error tracking |
| Infrastructure monitoring | Datadog or Grafana Cloud | $10-25K/yr | Latency, throughput |
| Real-user monitoring | Sentry RUM or LogRocket | $5K/yr | Diner-side error visibility |
| On-call rotation | 3-4 engineers minimum | $200-300K/yr | Friday-night dinner coverage |

**Total ops budget:** ~$50-80K/yr in tooling + 20-40% of one engineer's time forever for ops/reliability work.

**Required operational practices:**
- 99.9% uptime SLA (8.7 hrs/yr) — achievable single-region with multi-AZ
- Sub-30-minute response to Sev1 during dinner-service hours (5pm-11pm local)
- Documented runbooks for top 20 failure modes
- Post-mortems within 5 business days of every Sev2+
- Monthly chaos engineering rehearsals
- Customer-facing SLA documentation + credit policy

---

## 8. Compliance Surface

### 8.1 PCI DSS scope
**SAQ A confirmed** via Stripe Connect Standard + Stripe.js + Elements. We never touch PAN/CVV. Annual ASV scans (PCI DSS v4.0 requirement) cost ~$3K/yr.

### 8.2 California SB 1524 (effective July 1, 2025)
Conspicuous fee disclosure on menus and booking pages. Implementation:
- Reservation booking flow shows policy text inline before payment
- Required checkbox consent
- Stored `policy_version_id` + `consent_at` + `consent_ip` on each reservation
- Restaurant cannot change policies retroactively for existing reservations

### 8.3 1099-K reporting
TY2025 federal threshold: $20,000 + 200 transactions. **Stripe issues 1099-K directly to restaurants on Standard accounts.** We have zero direct issuance burden. State threshold variance (VT, MA, VA, MD use $600) handled by Stripe.

### 8.4 TCPA + CAN-SPAM
- TCPA: SMS only 8am-9pm in recipient's local timezone (8pm in FL, others)
- Separate consent for email and SMS at signup (one does not imply the other)
- One-click unsubscribe on every send
- Pre-flight compliance check blocks send if consent flag missing

### 8.5 GDPR (EU restaurants, future)
- Data subject access requests via diner self-serve export
- Right to deletion (restaurant must remove diner profile within 30 days of request)
- Audit log retains anonymized records of deletion for compliance proof

### 8.6 No-show fee state regulation
California, Connecticut, Minnesota, Massachusetts have proposed automatic-service-charge rules. Pattern: present policy at booking time, require explicit checkbox consent, store consent timestamp + policy snapshot. Monitor [National Law Review](https://natlawreview.com/article/service-charges-hospitality-recap-2025) quarterly.

---

## 9. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Toast favors Resy partnership, slows our integration approval | Medium | High | Prioritize Square + Lightspeed first; Toast is M3 not M1 |
| Resy / OpenTable refuse cross-platform AI Concierge data access | High | Certain | Use public scraping where ToS-compliant; user-uploaded confirmation emails as fallback |
| State no-show fee regulation creep | High | Medium | Policy versioning + explicit consent capture from day one |
| Stripe outage knocks out booking + check-in | High | Low | Accept for MVP; Adyen as backup is post-Series-A |
| Restaurant onboarding abandonment at KYC step | High | High | Allow "browse mode" with deferred KYC; finish reservations setup first |
| Diner reservation dispute volume on no-show charges | Medium | High | Auto-collect evidence at booking (timestamp, IP, consent, policy text snapshot) |
| Multi-tenant RLS bug leaks one restaurant's data to another | Catastrophic | Low | Pen-test before launch; row-level integration tests; audit logs |
| Scaling Supabase to 10K+ restaurants | Medium | Medium | $500-1K/mo at projected scale; revisit at 50K restaurants |
| Friday-night Sev1 incident damages reputation with first cohort | Catastrophic | Medium | $50-80K/yr ops tooling; 24/7 on-call from Day 1 of GA |
| Mission drift to extract restaurant data for cross-sell | Strategic | Low | Bylaw + manifesto; PBC charter; quarterly board check |

---

## 10. 18-Month Build Roadmap

| Month | Focus | Output |
|-------|-------|--------|
| **M1-2** | Dining P0-P1 (consumer module foundation + restaurant manager) | MyLife Dining module visible in hub |
| **M3** | Dining P2-P3 (visit log + photos + dish tracking) | Consumer dining log functional |
| **M4** | Dining P4-P5 (wishlist + reservation tracking + deep-links) | Consumer module feature-complete for V1 |
| **M5** | Dining P6 (cross-module integration) + start `@mylife/payments-advanced` package | Cross-module integrations live |
| **M6** | Restaurant SaaS package scaffold + Stripe Connect MVP (3-week sprint) | Restaurant can onboard, accept booking with deposit |
| **M7** | Floor plan editor + reservation calendar | Operator-side V1 (R2 + R3) |
| **M8** | Waitlist + Guest CRM | Walk-in + CRM live (R4 + R5) |
| **M9** | Email/SMS marketing + analytics | Marketing automation live (R6 + R7) |
| **M10** | `@mylife/pos-adapters` core + Square integration | First POS integration in production (R8) |
| **M11** | Toast integration | Top-2 POS coverage (R9) |
| **M12** | Lightspeed K-Series integration + ops tooling buildout | Ops posture production-grade (R10) |
| **M13** | Clover integration + Omnivore for Aloha/Micros | Top-5 POS coverage ~75% of US (R11) |
| **M14** | Differentiator features + AI floor plan from photo | Wedge features (R12) |
| **M15** | Year-2 founder-led NYC restaurant acquisition (50-100 restaurants) | First operator cohort live (R13) |
| **M16-18** | Refinement based on first-cohort feedback; expand to LA, SF, Chicago | Beachhead complete |

---

## 11. Open-Source Protocol Option (Year 3-5 Strategic)

Defer the federation question until after Year 1 ships. The path remains open:

- Design the canonical schema (Section 5.2) with eventual federation in mind
- Publish v0.1 spec of "MyLife Reservations Protocol" in Year 3
- MyLife Reservations SaaS becomes the reference server implementation
- Other clients/servers can implement the protocol
- Restaurants self-host or pick any compliant provider
- Federated like email, ActivityPub, Matrix, AT Protocol

**This converts the strategic question from "compete with Resy" to "make Resy irrelevant via open standard."** The WordPress model: open spec + reference implementations + paid hosted offering.

---

## 12. Mission Lock and Manifesto Application

The MyLife manifesto applies fully to the restaurant SaaS with one careful scope refinement:

| Promise | Application to restaurant SaaS |
|---------|-------------------------------|
| Never sell user data | Diner data: never. Restaurant operational data: aggregated/anonymized analytics may be published; never sold to third parties. |
| Never raise prices on existing customers | Restaurant subscription price-locked at signup tier, inflation-indexed only |
| Never run ads | No promoted restaurants in MyLife Dining; no advertising surface in operator UI |
| Never use dark patterns | One-tap cancel for restaurant subscription; full data export anytime |
| Never sell to private equity | Restaurant SaaS subsidiary inherits PBC charter |
| Never take VC that breaks promises | Year-2-3 capital raise specifically for restaurant SaaS will be aligned-only |

**Scope refinement:** the manifesto's "we never sell user data" applies to **diners** unconditionally. **Restaurants** own their own operational data and can choose to share it. We sell SaaS to restaurants; we never sell anything *about* restaurants.

---

## 13. Next-Session Handoff

To execute this design:

1. Read `restaurant-saas-r0-r13-mission-control.md` for the prompt-by-prompt build queue
2. Read the implementation plan at `/docs/plans/queue/07-restaurant-platform-implementation.md` for phase-by-phase task structure
3. Begin with Dining module P0 (foundation scaffold)
4. The mission control file is the primary execution interface — every prompt is copy-paste-ready

End of design document.
