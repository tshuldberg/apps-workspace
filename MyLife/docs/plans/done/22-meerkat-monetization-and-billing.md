# Plan 22 — Meerkat Monetization: $4.99 one-time app + freemium server-space billing

> **BINDING PRICING-LOCK OVERRIDE (2026-07-06).** The founder locked pricing on 2026-07-05: exactly TWO prices — `meerkat_app_unlock` $4.99 one-time, and `MEERKAT_HOSTED_MONTHLY_PRODUCT` $4.99/month with storage included. This override supersedes EVERY reference in this document to: repricing the hosted SKU off the cost ledger, a yearly SKU (`meerkat_hosted_yearly`), a metered storage-overage SKU, or a separate `meerkat_hosted_storage` SKU. None of those may be built without a new explicit founder decision. Over-cap storage is a product limit (honest meter, reject-before-write), not a price. UI copy must say "storage included", never offer "add more space monthly/yearly". Phase 0 (app-unlock product + entitlement + price-lock tests) LANDED 2026-07-06 in `3397651b`. TC-1 and phase steps referencing reprice/yearly are amended accordingly.

> Buildable implementation plan for founder review and later execution.
> Adapted from `docs/plans/templates/agent-feature-spec-template.md` to Meerkat's real structure
> (`apps/meerkat`, `apps/meerkat-web`, `packages/sync`, `packages/meerkat-relay`, `packages/entitlements`, `packages/billing-config`, `packages/ui`).
> Honors the standing **no-deferral / full-function** rule and the **transport-honesty** rule.

---

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). The current code implements the founder-locked two-price
model: `meerkat_app_unlock` $4.99 one-time and `MEERKAT_HOSTED_MONTHLY_PRODUCT`
$4.99/month with hosted storage included. Verified anchors include
`packages/billing-config`, `packages/entitlements/src/meerkat-app.ts`,
`packages/entitlements/src/meerkat-app-token.ts`, RevenueCat mobile wrapper,
web app-unlock UI, hosted service bin, hosted Dockerfile, Stripe billing client,
hosted API app-unlock/link endpoints, storage ingest, and parity locks. Store
product setup, RevenueCat keys, Stripe live config, receipt-provider credentials,
and live billing/deploy runs remain founder-ops in the runbook.

## Metadata

- **Surfaces:** `apps/meerkat` (Expo Router), `apps/meerkat-web` (Vite React SPA), `packages/meerkat-relay` (@mylife/meerkat-relay, hosted service + Stripe billing API), `packages/entitlements` (@mylife/entitlements), `packages/billing-config` (@mylife/billing-config), `packages/sync` (@mylife/sync, entitlement-token plumbing + a resumable huge-file upload-manifest that reuses existing blob chunking/hash — no new crypto), `packages/ui` (theme tokens only).
- **Priority Score:** 46 / 50 (S-Tier). Market 5×3 + Switching 4×3 + Complexity(inverse) 1×2 (Complex) + CrossModule 5×1 + PaidUser 5×1. This plan *is* the revenue model; nothing ships money without it.
- **Estimated CC time:** ~6–7 focused build sessions (Phase 0–6; Phase 6 is the harvested huge-file / archive storage stream). Tier-D items (real store sandbox purchases, real Stripe test-mode runs, App Store review, real provider invoices, live deploy, real 10 GB–1 TB device uploads + metered usage reporting) are human/ops and run in parallel.
- **Depends On (hard):**
  - **Plan: Connectivity + self-hosting** — the hosted server-space tier is only honest when a real relay + community node are deployed and `DEFAULT_RELAY_URL` is set (`apps/meerkat/app/(root)/data/sync-core.ts:103`, `apps/meerkat-web/src/lib/relay.ts:14`). Until then, server-space UI must render "Not connected", never a fake meter.
- **Depends On (soft):**
  - **Plan: Public social layer** — defines which features are *free to view* (public channels/communities/forums) vs *private/create* (gated behind the one-time unlock). The app-unlock gate's feature list must match that boundary.
  - **Plan: Full DMs** — DMs are a private/create feature behind the one-time unlock; the gate feature list includes them.
  - **Plans: Public social + Full DMs (huge-file destinations)** — Part 3 routes an ingested large file into a Meerkat community channel (public-social / community node, plan 19) or a DM thread (plan 21), or to device files. Those destinations are owned by those plans; Part 3 owns only the storage ingest + billing, not the channel/DM surfaces.
- **Blocks:**
  - **Plan: Launch readiness** — launch cannot certify pricing, store approval, or "paid features actually work" until this lands.
- **Build order:** Part 1 (one-time app unlock) has **no hard dependency** and can build first. Part 2 (server-space billing) depends on the connectivity plan's deployed relay/community node. Part 3 (huge-file / archive storage) **extends Part 2** and lands with or after the deployed hosted service. Within this plan: Phase 0 → 1 → 2 → (3 ∥ 4) → 5 → 6.

---

## Status Delta (2026-07-01, read first)

**Partially landed ahead of schedule.** During Plan 19 P9 work (2026-06-30, commits `17f75103`, `52b592a8`, `9c518f79`, `790f0cc6`, `f59ae209`), a "Stage 0" slice shipped that equals roughly Phase 1 in full, plus the engine half of Phase 6, plus one Phase-0-adjacent item. Executors MUST re-derive remaining work BY FEATURE, not by phase number.

What exists now:
1. Tier-to-cap map + `usageForSubject` + `GET /api/usage/meerkat`: `packages/meerkat-relay/src/hosted-node.ts:58-66,152,173` and `hosted-api.ts:15-16,89,353,375`.
2. `meerkat:hosted-storage` entitlement feature: `packages/entitlements/src/meerkat-hosted.ts:13-18`.
3. Resumable upload manifest: `packages/sync/src/blob/upload-manifest.ts` (135 lines) plus tests.
4. `POST /api/storage/upload` with cap-reject-before-write, per-block hash verify, resume bitfield: `packages/meerkat-relay/src/storage-ingest.ts` (222 lines); usage storage breakdown at `hosted-api.ts:380-392`; retention map in `hosted-node.ts`.
5. Sync-policy guard tests for the 5 `mk_settings` storage keys: `apps/meerkat/app/__tests__/sync-core.test.ts:186-197` and the web twin `community-sync-policy.test.ts` (guards exist AHEAD of the feature that writes those keys).

What remains (verified absent 2026-07-01):
- **Phase 0 money-model reconcile: FOUNDER PRICING DECISION 2026-07-05 (binding, supersedes this plan's reprice item).** Meerkat has exactly two prices: the app is **$4.99 one-time**, and the hosted subscription is **$4.99/month WITH hosted storage included**. This OVERRIDES resolution item 2 above (`MEERKAT_HOSTED_MONTHLY_PRODUCT` is NOT repriced off the cost-plus ledger; it stays $4.99/mo) and RESOLVES the "Founder decision needed at Phase 0" storage question: storage stays bundled in the monthly SKU, no separate metered SKU. A billing-config test (`meerkat-hosted-product.test.ts`) locks the price and the bundled `meerkat:hosted-storage` entitlement. An interim $8.75 ledger reprice (commit `c2b8e259`) was reverted same-day on founder correction. STILL REMAINING for Phase 0: no `meerkat_app_unlock` anywhere; no `packages/entitlements/src/meerkat-app.ts`; `apps/meerkat/app/__tests__/app-config.test.ts:75` still asserts `react-native-purchases` is undefined.
- **Phase 2 hosted billing service:** no `StripeMeerkatBillingClient`, no `SqliteMeerkatBillingStore`, no `tier` field on `MeerkatHostedSubscription` in `hosted-api.ts:33-40`, no `bin/meerkat-hosted-service.mjs`, no `Dockerfile.hosted`, no `meerkat_app_purchases`/`meerkat_app_links` tables.
- **Phase 3 mobile IAP:** no `upgrade.tsx`, `react-native-purchases` not declared; mobile `settings.tsx:128-131` calls `buildHostedBoundaryItems` without `hostedRelayUrl`/`hasHostedRelayEntitlement`, so the `paid_required`/`included` branches in `hosted-boundaries.ts:80-126` are dead code; `SyncProvider.tsx:1221` calls `connectRelayPeer` without an entitlement-token resolver.
- **Phase 4 web purchase UI:** token plumbing is already real in `MeerkatProvider.tsx:326-334,781-834`; no checkout/restore/link UI.
- **Phase 5 e2e:** not started.
- **Phase 6 remainder:** no overage dollar rate (`hosted-pricing.ts` still says overage pricing is future work, TC-14 unmet); no `meerkat_hosted_storage` or yearly SKU in `billing-config`; no background `URLSession` upload task; no Screen C on either surface; no writers for the 5 guarded `mk_settings` storage keys.

**Founder decision needed at Phase 0:** `billing-config` `featuresDefault` (`packages/billing-config/src/index.ts:168`) already bundles `meerkat:hosted-storage` into the `meerkatHostedMonthly` SKU (set during S0.6). Phase 0 must decide: keep storage bundled in the monthly SKU, or split it into the separate metered SKU Phase 6 describes. The plan does not currently reconcile this.

**New dependency (2026-07-01 founder decision):** hosted signup/checkout must require the Plan 24 humanity-verification credential before account/tenant creation. Add the verification check to the Phase 2 signup/checkout path when Plan 24 lands its issuance service.

**Line drift:** `sync-core.ts` `DEFAULT_RELAY_URL` export is now at `:127` (`readDefaultRelayUrl` at `:115`); the `app-config.test.ts` assertion now falls effectively at `:74-78`.

---

## Business Context

### Why this exists

Meerkat today advertises a price it **cannot collect**. `$4.99` appears exactly once in the mobile app as static text (`apps/meerkat/app/(root)/(tabs)/settings.tsx:319`) and once on web (`apps/meerkat-web/src/ui/settings/HostedServicesSection.tsx:22-26`), with **no in-app purchase SDK, no paywall, no Buy/Restore, and no entitlement the user can act on**. The test suite even *asserts* the IAP SDK is absent (`apps/meerkat/app/__tests__/app-config.test.ts:73-77`; the `react-native-purchases` assertion is line `:75`). Meanwhile the word "$4.99" means **three contradictory things** across the codebase (detailed below). This plan reconciles the price into one honest model and builds the two real money paths: a one-time app unlock and a freemium server-space subscription, both backed by real receipts/invoices and real usage rows.

### The three conflicting meanings of "$4.99" (must reconcile)

| Where | Current meaning | Evidence |
|---|---|---|
| Mobile + web Settings copy | **One-time app price** ("The $4.99 app covers private local use") | `apps/meerkat/app/(root)/(tabs)/settings.tsx:319`; `apps/meerkat-web/src/ui/settings/HostedServicesSection.tsx:22-26` |
| Entitlements + relay billing | **$4.99 / month hosted subscription** | `packages/billing-config/src/index.ts:135-139` (`MEERKAT_HOSTED_MONTHLY_PRODUCT { price: 4.99, type: 'monthly' }`); `packages/entitlements/src/meerkat-hosted.ts:150` ("$4.99/month Meerkat plan") |
| Hub product catalog | **Per-module standalone unlock** ($4.99 each) | `packages/entitlements/src/types.ts:10-11`; `packages/billing-config/src/index.ts:47-78` (`PRODUCTS.standaloneModules.*.price = 4.99`) |

**Resolution (founder-approved 2026-06-28; the original production-review artifact remains in git history, while current reports are cataloged in `docs/reports/README.md`):**

1. **`$4.99` = the one-time Meerkat app unlock.** A new canonical product `meerkat_app_unlock` (`one_time`, $4.99). Unlocks full **private / local / device-to-device** use forever. The app is **free to download**; **public viewing stays free** (no unlock needed to browse public channels/communities/forums).
2. **[SUPERSEDED by the 2026-07-05 founder pricing lock; struck 2026-07-06]** The hosted plan stays at its founder-locked **$4.99/month with storage included** (`MEERKAT_HOSTED_MONTHLY_PRODUCT` unchanged; a billing-config test locks the price and the bundled storage entitlement). Exactly two prices exist: the $4.99 one-time app unlock and the $4.99/mo hosted subscription. No reprice, no yearly SKU, no other SKUs without an explicit new founder decision.
3. **The per-module $4.99 is a MyLife-hub concern, not Meerkat.** `PRODUCTS.standaloneModules` (`packages/billing-config/src/index.ts:47-78`) stays as-is; a code comment marks it unrelated to the Meerkat app unlock so the magnitude coincidence never gets reused.

### Which competitor's users this wins

| Competitor | Model | Behind paywall? | What Meerkat takes |
|---|---|---|---|
| **Signal / Session** | Free, donation-funded | No | Users who want private DMs + groups but distrust "free = you're the product." A one-time $4.99 with *no subscription, no account, no telemetry* is a cleaner promise. |
| **Discord (Nitro)** | $9.99/mo subscription for the *whole app* | Yes | Self-host + same-Wi-Fi communities for free; pay only for hosted server space past a real free tier. "Spin up a Discord from your laptop" without the recurring fee. |
| **Telegram Premium** | $4.99/mo subscription | Yes | Users tired of recurring billing — Meerkat is buy-once for private use; hosting at scale is the only recurring cost, and it is optional + self-hostable. |
| **Keet / Briar (P2P)** | Free, no monetization, hard to use | No | Users who want decentralized + buy-once *and* an easy hosted option when they want reach. |

**Target user:** a privacy-minded mainstream user (the Signal/Telegram/Discord overlap) who will pay **once** for a real private messenger they own, and who self-hosts or pays a small, honest, usage-based fee only when they want always-on hosted reach. Migration path: install free → browse public content → hit a create/DM action → one-tap $4.99 unlock → optional server space later.

### Honesty contract for this plan (non-negotiable)

- **Never gate local/private/LAN/self-host use behind the recurring server payment.** The one-time unlock (Part 1) and the server-space subscription (Part 2) are **two separate entitlements**. A lapsed subscription must **never** re-lock locally-created content.
- **Hosted = paid only when actually connected.** If no hosted relay/community node is deployed/connected, the server-space UI shows "Not connected", not a fabricated meter.
- **Every number shown comes from a real row.** Usage meters read `SeederNodeStats` / `HostedTenantStats` (`packages/meerkat-relay/src/seeder-node.ts:135-149`, `src/hosted-node.ts:45-47,125-131`) and on-device `NodeStoreStats`. No fabricated bytes, peers, or "0 of 1 GB" placeholders.
- **No fake purchase.** The unlock gate derives from a **real** StoreKit/Play receipt (mobile) or a **verified** Stripe/account purchase (web). In Expo Go / no native module / no store, the gate **fails closed (locked)**; public browsing still works.
- **Pricing dollar figures are illustrative until real provider invoices replace them** (`packages/meerkat-relay/src/hosted-pricing.ts:59-64,107,133-135`). UI must surface the `illustrative` flag and must not present placeholder dollars as final.
- **Never imply cross-rail auto-restore.** Mobile (StoreKit/Play) and web (Stripe) are separate purchase rails with no shared account. A purchase on one rail does **not** silently unlock the other. The UI states this plainly and offers the optional Link-code path; it must never pretend a single buy covers both rails for free.

---

## Current-State Grounding (what exists vs net-new)

### Already real (extend, do not rebuild)

| Capability | Status | File:line |
|---|---|---|
| Hosted entitlement crypto: issue + verify signed HMAC tokens | **REAL + tested** | `packages/entitlements/src/meerkat-hosted.ts:151-211`; features `meerkat:hosted-relay`, `meerkat:community-node` (`:10-16`) |
| Bearer token (de)serialization, fail-closed parse | **REAL** | `packages/entitlements/src/meerkat-hosted.ts:120-148` |
| Hosted billing + entitlement HTTP API (Stripe checkout/portal/webhook + `GET /api/entitlements/meerkat`) | **REAL handler, NOT instantiated** | `packages/meerkat-relay/src/hosted-api.ts:288-340`; injection points unimplemented (`:59-79`) |
| Relay-side entitlement gate (fail-closed, opt-in, off by default) | **REAL + tested** | `packages/meerkat-relay/src/server.ts:149-189,227-267`; community node `community-node-http.ts:263-292` |
| Multi-tenant hosted-node runtime (per-tenant isolated store + storage cap) | **REAL runtime, not deployed** | `packages/meerkat-relay/src/hosted-node.ts:53-132` |
| Real server-space usage rows (storage/cap/egress/peers) | **REAL** | `packages/meerkat-relay/src/seeder-node.ts:135-149,338-356`; per-tenant `src/hosted-node.ts:125-131` |
| Transparent cost-plus pricing ledger (+25% markup), self-flagged illustrative | **REAL engine, placeholder $** | `packages/meerkat-relay/src/hosted-pricing.ts:82-137` |
| Billing product config (`MEERKAT_HOSTED_MONTHLY_PRODUCT`, SKUs, SKU→entitlement defaults) | **REAL** | `packages/billing-config/src/index.ts:127-170` |
| Client entitlement-token plumbing on the wire (relay hello carries `entitlement`) | **REAL** | `packages/sync/src/transport/relay-transport.ts:41-42,71-72,202-247`; `websocket-relay-backend.ts:109-150,173-175` |
| Web hosted-access lib (fetch token, cache, `relayRequiresHostedPayment`, 402 handling) | **REAL, no UI to invoke** | `apps/meerkat-web/src/lib/hosted-access.ts:50-80` (token cache + `fetchHostedEntitlementToken`/402) and `:32-34` (`relayRequiresHostedPayment`) |
| Provider `HostedAccessState` (`canUseRelay`, `relayRequiresPayment`, `setEntitlementToken`/`clearEntitlementToken`) | **REAL, no UI to invoke** | `apps/meerkat-web/src/lib/MeerkatProvider.tsx:326-334` (interface, `canUseRelay`/`relayRequiresPayment` at `:332-333`); impl `:789-792`; wiring `:800-801` |
| Hosted-boundary read-only panel (honest limits) | **REAL, read-only** | `apps/meerkat/app/(root)/data/hosted-boundaries.ts:80-126`; `apps/meerkat-web/src/lib/hosted-boundaries.ts` |
| Deploy artifacts (slim relay Dockerfile, Render/Fly/Compose/Caddy) | **REAL templates, not deployed** | `packages/meerkat-relay/Dockerfile`, `render.yaml`, `deploy/*` |

### Net-new (this plan builds it)

| Net-new | Surface |
|---|---|
| `meerkat_app_unlock` one-time product (LANDED 2026-07-06, `3397651b`; hosted SKU unchanged per pricing lock, no yearly SKU) | `packages/billing-config` |
| `@mylife/entitlements` `meerkat-app.ts`: `MEERKAT_APP_UNLOCK_FEATURE` + `deriveMeerkatAppUnlock()` (pure, receipt-derived, **local**) | `packages/entitlements` |
| Concrete injection-point implementations: `StripeMeerkatBillingClient`, `SqliteMeerkatBillingStore`, `authorize()` | `packages/meerkat-relay` |
| One-time app-unlock checkout + `GET /api/entitlements/meerkat-app` (web account restore) | `packages/meerkat-relay/src/hosted-api.ts` |
| **Optional cross-rail link:** `POST /api/link/meerkat-app` (server-side StoreKit/Play receipt validation + Stripe purchase) → mints Link code; `GET /api/entitlements/meerkat-app?link=<code>` redeems it; `meerkat_app_links` table (F1) | `packages/meerkat-relay/src/hosted-api.ts` + both UIs |
| `GET /api/usage/meerkat` — real per-subject server-space usage from `HostedNodeService.stats()` | `packages/meerkat-relay/src/hosted-api.ts` + `hosted-node.ts` |
| Extend `MeerkatHostedSubscription` with a net-new `tier` field (interface has none today, `hosted-api.ts:22-29`) + `MeerkatHostedTier` type | `packages/meerkat-relay` |
| Tier → storage-cap mapping; free-tier provisioning; webhook-driven cap raise | `packages/meerkat-relay` |
| Deployed **hosted-service** image (composes hosted-api + HostedNodeService) — second image, not the slim relay | `packages/meerkat-relay/Dockerfile.hosted` + `deploy/` |
| Mobile IAP (RevenueCat `react-native-purchases`): purchase / restore / on-device unlock gate (lazy-loaded, fail-closed) | `apps/meerkat` |
| Mobile **Unlock** paywall screen + actionable **Server space** UI (usage meter, checkout/portal, enter token, restore) | `apps/meerkat` |
| Web app-unlock purchase (Stripe one-time) + restore + gate; actionable `HostedServicesSection` | `apps/meerkat-web` |
| Wire `hostedRelayUrl` / `hasHostedRelayEntitlement` into the boundary panel on **both** surfaces (kills today's dead `paid_required`/`included` UI — `hosted-boundaries.ts:44-61`) | both |
| Mobile entitlement-token plumbing into the engine connect path (`mk_settings` keys; today only web sets it) | `apps/meerkat` |
| Replace illustrative pricing source + UI gating on the `illustrative` flag | `packages/meerkat-relay`, both UIs |

---

## Data Model / Schema + table-prefix + sync-policy

### Client (device-local, must NOT replicate)

Both surfaces store billing/entitlement state **device-local only**. On mobile this reuses the existing `mk_settings` key/value table (prefix `mk_`, which is deliberately **outside** the sync prefix map and never replicates — see `apps/meerkat/CLAUDE.md` "Table prefixes"). No new SQLite table is created; new keys only:

```
-- mk_settings (existing k/v table, prefix mk_, scope = device_local, never replicated)
-- NEW keys:
'hosted_api_url'              -- string, the hosted billing/usage API base (paste or shipped default)
'hosted_relay_url'            -- string, the first-party hosted relay wss:// (for isHostedRelayUrl())
'hosted_entitlement_token'    -- string, server-issued short-lived signed token (mirrors web localStorage)
'app_unlock_receipt_id'       -- string, store transaction/receipt id for the one-time unlock (cache only)
'app_unlock_purchased_at'     -- ISO string, real purchase date (display only)
'hosted_usage_snapshot_json'  -- string, last real usage read (HostedTenantStats subset) for the partial/stale state
'hosted_usage_fetched_at'     -- ISO string, when that snapshot was read
```

Web mirrors these in `localStorage`: existing `meerkat_hosted_entitlement_token` (`apps/meerkat-web/src/lib/hosted-access.ts:1`), plus new `meerkat_app_unlock_state` and `meerkat_hosted_usage_snapshot`.

**Sync-policy change / security note (critical):**
- These keys are `device_local` with **maxScope = device_local**. They MUST never be promoted to `personal_replica` or `shared_workspace`. Adding them to the `mk_` (non-replicating) namespace already guarantees this; the plan adds a guard test asserting no billing key name appears in any synced table or sync prefix map.
- **Why:** a replicated entitlement/receipt could be replayed onto a second device to unlock without purchase, and a replicated hosted token would leak a bearer credential across the mesh. **Cross-device restore is the store's/Stripe's job, never the mesh's.** The app-unlock is restored via StoreKit/Play account restore (mobile) or the account-scoped `GET /api/entitlements/meerkat-app` (web) — both re-derive from a real purchase, not from synced state.
- No `ConflictStrategy` / `COMMUNITY_SYNC_POLICY` changes are needed because nothing here syncs. The plan explicitly records that decision so a future agent does not "helpfully" add a sync policy to billing rows.

### Server (the deployed hosted service's own DB — never the zero-knowledge relay)

The slim relay image stays ws+zod-only and stores nothing (`packages/meerkat-relay/Dockerfile`, `CLAUDE.md` "Deploy"). Billing/usage state lives only in the **separate hosted-service** image's DB:

```sql
-- meerkat_hosted_subscriptions  (shape = MeerkatHostedSubscription, hosted-api.ts:22-29 TODAY)
-- NOTE: `tier` is a REQUIRED NET-NEW field. The current interface (hosted-api.ts:22-29)
--       has subjectId/status/customerId?/subscriptionId?/currentPeriodEnd?/updatedAt and NO tier.
--       This plan extends MeerkatHostedSubscription with `tier: MeerkatHostedTier`
--       ('free'|'starter'|'community'|'fleet'); the column below mirrors that new field.
subject_id TEXT PRIMARY KEY,
status TEXT NOT NULL,                  -- trialing|active|past_due|canceled|incomplete|unpaid|paused
tier TEXT NOT NULL DEFAULT 'free',     -- NET-NEW: free|starter|community|fleet (maps to storage cap)
customer_id TEXT, subscription_id TEXT,
current_period_end TEXT,
updated_at TEXT NOT NULL

-- meerkat_app_purchases  (shape = Purchase, entitlements/types.ts:57-64; web/account restore + cross-rail link)
subject_id TEXT NOT NULL,
product_id TEXT NOT NULL DEFAULT 'meerkat_app_unlock',
rail TEXT NOT NULL,                    -- 'stripe' | 'storekit' | 'play' (which rail validated it)
purchase_date TEXT NOT NULL,
is_active INTEGER NOT NULL DEFAULT 1,
PRIMARY KEY (subject_id, product_id)

-- meerkat_app_links  (OPTIONAL cross-rail reconciliation; see F1 boundary below)
link_code TEXT PRIMARY KEY,            -- random, single-purpose, rate-limited
subject_id TEXT NOT NULL,              -- the purchase this code unlocks (FK -> meerkat_app_purchases)
created_at TEXT NOT NULL,
expires_at TEXT NOT NULL,              -- short TTL; consumed-or-expired
consumed_at TEXT                       -- non-null once redeemed on the other rail
```

**Cross-rail restore boundary (F1, critical, documented on purpose):** mobile unlock is validated by StoreKit/Play (RevenueCat `CustomerInfo`); web unlock is validated by Stripe + `GET /api/entitlements/meerkat-app`. **A purchase on one rail does NOT auto-restore on the other**, because Meerkat requires **no account**, so there is no implicit identity to join the two stores. This is a real boundary, not a bug — and it is reconciled by an **optional, opt-in Link code** (next section), never by the mesh.

**Server security note:** the hosted DB holds the entitlement **secret** and webhook secret (env only, never shipped to clients), Stripe customer/subscription ids (PII-adjacent — access-controlled, not logged), and usage stats. The relay/community node remain zero-knowledge: they only ever *verify* a token, never store billing data (`server.ts:149-189`). Tenant usage isolation is structural (`hosted-node.ts:109-113`).

### Optional cross-rail account-link / reconciliation (resolves F1, no-deferral)

Because there is no account, cross-rail restore is **explicit, opt-in, and mediated by the deployed hosted billing service** (the same Phase-2 image) — never the mesh:

1. On the rail where the user already unlocked, they tap **"Link this purchase"** → the app sends a **server-validated proof** to `POST /api/link/meerkat-app`:
   - **Web (Stripe):** the purchase is already a `meerkat_app_purchases` row keyed by the web `subject_id` (`rail='stripe'`).
   - **Mobile (StoreKit/Play):** the app sends the store JWS receipt; the hosted service **validates it server-side** against the **App Store Server API** / **Google Play Developer API**, then writes a `meerkat_app_purchases` row (`rail='storekit'|'play'`). The app never self-certifies — the same fail-closed discipline as the relay.
2. The service mints a single-purpose, expiring **Link code** (`meerkat_app_links`) bound to that purchase and shows it to the user.
3. On the other rail, the user enters the code → `GET /api/entitlements/meerkat-app?link=<code>` verifies it maps to an active purchase, marks it `consumed_at`, and returns `{ unlocked: true, purchaseDate }`. That rail caches the unlock locally (still re-validated on cold start when reachable).

The Link code is **not** a wire/mesh credential and **never syncs** (the source of truth is the hosted purchases table; the device only caches the resulting unlock). It requires the connection server (network); the default no-account promise stands and cross-rail is an optional convenience. Refund/chargeback on the originating rail flips `is_active=0`, and a re-validation of any linked rail then returns locked (data preserved).

---

## Protocol / Engine changes in @mylife/sync (no new crypto)

`@mylife/sync` already carries the entitlement token to the relay; **no cryptographic change is required.** The only sync-layer work is wiring, on mobile, what the web client already does:

- The relay backend reads an `entitlementToken` that may be a value or a `() => string | null` resolver (`packages/sync/src/transport/websocket-relay-backend.ts:109-150,173-175`). Mobile will pass a resolver that reads the `hosted_entitlement_token` `mk_settings` key, but **only when the configured relay equals the first-party hosted relay** (mirroring web `entitlementTokenForRelay` at `apps/meerkat-web/src/lib/MeerkatProvider.tsx:781-787`). For a self-host / community relay, the token is omitted.
- `RelayTransportOptions.entitlementToken` (`relay-transport.ts:41-42,71-72`) is the existing seam; the mobile sync provider supplies it on `connectRelayPeer` calls.

**Security analysis (engine path):**
- The token rides inside the `hello` frame only (`websocket-relay-backend.ts:148-150`); the relay forwards `env` verbatim and never sees the token in payload traffic, preserving the zero-knowledge invariant (`server.ts:236-244`, hub `hub.ts:8-12`).
- Verification is **fail-closed and server-side** (`server.ts:182-189`, `verifyHostedFeatureEntitlement` reasons at `meerkat-hosted.ts:184-209`): missing → `entitlement_required`, anything else invalid → `entitlement_invalid`. The client UI displaying "Entitlement present" is **cosmetic**; pasting a bogus token cannot grant access because the server re-verifies on every `hello`/`pub`/`res`/`ann`/`lk` (`server.ts:227-269`).
- Token is **short-lived** (default 15 min, `hosted-api.ts:86,250-254`) and `min(ttl, currentPeriodEnd)` capped (`hosted-api.ts:156-165`), so a lapsed subscription stops issuing tokens and existing tokens expire fast — the privacy boundary lives in the payload/token, not the channel.
- The app-unlock entitlement is **not** a wire credential at all; it never touches the relay. It is a local gate. This keeps the one-time purchase off the network entirely (no server can revoke a bought app).

---

## Functional Requirements

### User stories

1. As a **new user**, I open Meerkat free, browse public channels/communities/forums, and pay **$4.99 once** to unlock creating my own content, DMs, communities, and device-to-device sync — forever, with no subscription.
2. As an **unlocked user on a second device on the same rail**, I tap **Restore** and the app unlocks from my store account without paying again. If my second device is on the **other rail** (e.g., I bought on web and now use iOS), I link the purchase with a one-time **Link code** rather than paying twice.
3. As a user who wants **always-on reach**, I see a **free server-space tier**, my **real** usage against it, and can add more space monthly/yearly **or** point at my own server.
4. As a **self-hoster**, I never pay anything and never see a payment wall for local/LAN/self-host use.
5. As a **lapsed subscriber**, my locally created content keeps working; only the hosted server space stops past the free tier, and the app says so honestly.

### Behavior — Part 1: one-time app unlock

1. App launches free. Public browsing works with no purchase. A create/DM/community/sync action is gated: tapping it (when locked) opens the **Unlock** screen.
2. Unlock screen loads the **real** store price (RevenueCat `Offerings` on mobile; Stripe Price on web). Shows $4.99 from the store, not hardcoded.
3. User taps **Unlock for $4.99** → native StoreKit/Play sheet (mobile) or Stripe Checkout (web). On success, the receipt/purchase is verified and `deriveMeerkatAppUnlock()` returns `unlocked: true`; gated features become available immediately.
4. **Restore** re-reads `CustomerInfo` (mobile) or calls `GET /api/entitlements/meerkat-app` (web) and unlocks if a real purchase exists.
5. The unlock is cached locally (`app_unlock_receipt_id`/`app_unlock_purchased_at` or `meerkat_app_unlock_state`) for offline launches, but is **re-validated** against the store/account on each cold start when reachable. Cache alone never grants unlock on a fresh install (must restore).
6. **Cross-rail (optional):** a user who bought on one rail (web Stripe vs mobile StoreKit/Play) can tap **"Link this purchase"** to mint a one-time **Link code** (needs the connection server; server-validates the receipt), then enter that code on the other rail to unlock there. Without linking, a web purchase does **not** unlock iOS/Android (and vice-versa); the UI says so plainly. Same-rail restore (item 4) needs no link.

### Behavior — Part 2: freemium server-space

1. **Server space** screen reads the configured hosted API + relay URL. If none is configured/deployed → **Not connected** state (free same-Wi-Fi/self-host explained).
2. If connected, it calls `GET /api/usage/meerkat` (authorized by subject) → real `{ storageBytes, storageCapBytes, bytesServed, peersServed, tier }` from `HostedNodeService.stats()` filtered to the subject's tenant. Renders a real meter.
3. Under free cap → "You're on the free tier." Over/near cap → **Add more space** (monthly/yearly) → `POST /api/billing/checkout` → Stripe Checkout. After payment, the webhook upserts the subscription and **raises the tenant's storage cap** (`provision`/re-provision with the tier's `storageCapMB`).
4. **Manage billing** → `POST /api/billing/portal` → Stripe portal.
5. **Enter access token** (advanced / community server) → paste → cache → used as the relay `entitlement`. Copy states clearly the **server** verifies and fails closed.
6. **Use my own server instead** → deep-links to the connectivity plan's self-host flow ("Host your own"). No payment. **Graceful fallback (if that route is not built yet):** the button never dead-ends — it opens an in-app explainer plus the existing connection-server **paste/QR adopt** field (the same `relay_url` entry already in Settings, `apps/meerkat/.../settings.tsx`) and links the self-hosting guide doc, so a user can point at their own `wss://` immediately even before the one-tap desktop companion ships. Feature-detect the self-host route and only deep-link when present.

### Edge cases

- **Expo Go / no `react-native-purchases` native module:** purchase + restore fail with guidance; gate **stays locked**; public browsing works. (Mirror the lazy-load + null-when-absent pattern of `apps/meerkat/app/(root)/data/lan-backend.ts`.)
- **No relay deployed / `DEFAULT_RELAY_URL === ''`:** server-space = "Not connected"; never a meter. (`sync-core.ts:103`.)
- **Pricing still illustrative (`illustrative: true`):** show the honest placeholder notice; checkout button labeled "Pricing being finalized" and disabled for the hosted tier (the **one-time app unlock price is real** and stays enabled).
- **Entitlement expired mid-session:** relay returns `entitlement_invalid`; client surfaces "Hosted access expired — refresh or it stays on free tier"; local/LAN unaffected.
- **Restore finds a subscription but no app unlock (or vice-versa):** the two entitlements are independent; resolve each separately, never conflate.
- **Refund / chargeback (webhook `purchase.refunded`):** subscription → `canceled`, tenant cap → free. App unlock refund (store) → `deriveMeerkatAppUnlock` returns locked on next validation; locally created content is **not deleted** (data preserved, like module disable).
- **Clock skew:** entitlement expiry uses server `now`; client never self-certifies validity.
- **Offline at launch:** unlock uses the cached flag to keep working; hosted features show last snapshot as **Partial** with timestamp until a live read succeeds.
- **Network mid-checkout:** Stripe success/cancel URLs handle return; on cancel, "You were not charged."
- **Two devices, one store account (same rail):** both restore to unlocked; server-space subscription is per-subject (account), shared cap.
- **Two rails (web Stripe vs mobile StoreKit/Play):** restore on each rail only sees that rail's purchase, so the second rail stays **locked** until the user opts into the **Link code** flow (`POST /api/link/meerkat-app` → enter code). If the connection server is unreachable, linking is unavailable and the UI says exactly that ("Linking needs a connection server"); the bought rail is unaffected. The Link code never syncs and is never required for same-rail use.
- **Link code abuse/expiry:** codes are single-use, rate-limited, and expire; a consumed/expired/forged code returns locked (fail-closed), never an unlock.

---

## UI Specification (both surfaces, all 5 states)

Use **Open Burrow** tokens (`apps/meerkat/app/(root)/theme/tokens.ts` `MK_PALETTES`; web mirror). Accent sea-green `#0E7C66`/`#58C5A5`. Meerkat owns its `Button` in `components/kit.tsx`. Mobile and web copy are kept **byte-aligned** (parity), differing only "device"↔"browser" like the existing boundary mirror.

### Screen A — Unlock (one-time app purchase)

**Mobile:** new route `apps/meerkat/app/(root)/(tabs)/upgrade.tsx` (`href: null`, push-only), reached from Me tab and from any gated action. **Web:** modal/route `apps/meerkat-web` reached the same way.

Proposed copy (verbatim):

- Title: **"Unlock Meerkat"**
- Body: "Meerkat is free to browse public channels, communities, and forums. A one-time **$4.99** unlocks full private use forever: create and seal your own content, direct messages, your own communities, device-to-device sync over Wi-Fi or a connection server, and self-hosting. No subscription. No account required."
- Primary button: **"Unlock for {storePrice}"** (storePrice from the store; falls back to "$4.99" copy only if the store quotes it)
- Secondary: **"Restore purchase"**
- Honest footnote: "This one-time purchase never expires and is not a subscription. It unlocks private and local features on this device — use Restore on other devices signed into the same store account. Buying on the web does not automatically unlock iOS or Android (and vice-versa), because Meerkat needs no account: to use one purchase on both, tap **Link this purchase** for a one-time code (needs a connection server). Hosted server space (always-on history, public posting at scale) is a separate, optional service, billed only when you use it past the free tier."
- Cross-rail action (optional): **"Link this purchase"** → mints a Link code on the bought rail; **"Enter link code"** → unlocks on the other rail. Both disabled with "Linking needs a connection server" when none is reachable.

| State | What the user sees | Trigger |
|---|---|---|
| Loading | Title + skeleton on the price/button; "Loading store…" | Fetching store offering |
| Empty | "Store not available here. Meerkat needs the App Store or Google Play to sell the unlock. Public browsing still works." Buttons disabled. | No native module / Expo Go / web store unreachable |
| Error | "Purchase didn't complete. You were not charged. Try again, or Restore if you already bought it." + Retry | Purchase throws/cancels with error |
| Success | Gated features enabled; toast "Unlocked. Full private use is on, forever." then screen dismisses | Real receipt verified |
| Partial | "Checking your purchases…" while Restore re-validates a cached/pending receipt | Cold start with cached flag, or pending transaction |

### Screen B — Server space (freemium hosted)

**Mobile:** actionable panel inside `settings.tsx` "Hosted services" (today read-only, `settings.tsx:314-320`) plus a detail route. **Web:** `apps/meerkat-web/src/ui/settings/HostedServicesSection.tsx` becomes actionable.

Proposed copy:

- Section title: **"Server space"**
- Intro: "Same-Wi-Fi sync and self-hosting are always free. Our main server gives you a free tier to share and post with others. Past the free limit, add space monthly or yearly — or host it yourself."
- Meter (real rows only): "Using **{usedGB}** of **{capGB} GB**" + progress bar; "{egressGB} GB served this period"; "{peers} devices served." (Source: `HostedTenantStats`/`SeederNodeStats`.)
- Actions: **"Add more space"** (monthly/yearly), **"Manage billing"**, **"Enter access token"**, **"Use my own server instead"**.
- Illustrative notice (only when `illustrative: true`): render the ledger's own `notice` string verbatim — "Illustrative pricing: figures are placeholders pending real provider invoices. The cost-plus policy (infra cost plus the listed markup) is final; the dollar amounts are not." (the real string at `hosted-pricing.ts:133-135`; do not paraphrase — surface `pricingLedger().notice` directly).
- Token-entry helper: "Pasting a token does not grant access. The server verifies it on every connection and fails closed if it is invalid or expired."

| State | What the user sees | Trigger |
|---|---|---|
| Loading | "Reading your real usage…" skeleton meter | Fetching `/api/usage/meerkat` |
| Empty / Not connected | "Not connected to a hosted server. You're using same-Wi-Fi and/or self-host only, which is free. Connect a hosted server to see usage here." (no meter) | No hosted API/relay configured or deployed |
| Error | "Couldn't reach the hosted server." or "Couldn't read usage — showing your last reading from {time}." + Retry | Fetch fails (shows snapshot if any) |
| Success | Real meter + tier + actions | Live usage read |
| Partial | "Showing your last saved reading ({time}); refreshing…" | Stale snapshot shown while refetching |

### Killing the dead UI

`hosted-boundaries.ts` `hostedRelayItem()` has `paid_required` / `included` branches that never render because Settings omits `hostedRelayUrl`/`hasHostedRelayEntitlement` (`apps/meerkat/.../settings.tsx:95-101`). Both surfaces will pass the real inputs (mobile reads the new `mk_settings` keys; web already has them via `m.hostedAccess` — `HostedServicesSection.tsx:9-14`), so the four states become reachable from real config + real entitlement presence.

---

## Part 3: Huge-File and Archive Storage (harvested from Universal Share phases 13–14)

This part extends Part 2's freemium server-space from "pin and serve a community catalog" to a real huge-file ingest pipeline (10 GB to 1 TB) for content a user uploads into a **Meerkat community channel** (plan 19 / community node), a **DM** (plan 21), or **device files**. It is harvested from the archived Universal Share program: the per-transport data-limit ladder and huge-file routing (archived `docs/plans/archive/09-universal-share-to-mesh-delivery.md` "Recommended Data Limits By Transmission Type", lines 134–198) plus the archive ingest pipeline (archived `docs/plans/archive/10-universal-share-mission-control.md` Phase 13 "Video, Picture, And File Sharing" lines 476–503 and Phase 14 "Archive Server And Forever Archive" lines 505–539). The hub/BestChef **module-resolver** framing is dropped; destinations are Meerkat channels, DMs, or files. Storage is metered against the **same** per-subject tenant rows and the **same** cost-plus ledger Part 2 already uses, so nothing new is faked.

### Where huge files go (routing, retargeted off module resolvers)

Three honest destinations, no module resolver:
1. A **Meerkat community channel** (served by the community node as opaque, hash-addressed pieces; plan 19).
2. A **DM thread** (plan 21).
3. **Device files** (local / LAN / self-host — always free).

Size ladder (stored in policy, not UI copy, per archive 09 line 189 "Store the recommended caps in policy, not hardcoded UI copy"):

| Size | Route | Source |
|---|---|---|
| under 1 GB | any encrypted route (LAN / nearby / WebRTC / relay) | archive 09:178–183 |
| 1–10 GB | **LAN preferred**, or hosted server upload with resumable chunks (WebRTC/relay only with confirmation) | archive 09:184; archive 10:62 |
| 10–500 GB | **hosted archive ingest only** (never phone-to-phone) | archive 09:185; archive 10:63 |
| 500 GB–1 TB | **hosted archive ingest only** | archive 10:64 |
| over 1 TB | **out of scope** (honest hard cap; future large-transfer mode) | archive 09:185 (escalated to the 1 TB ceiling) |

LAN / self-host / bring-your-own (BYO) stays **free and ungated at every size**. Hosted server ingest is the **only** metered path.

### Already real (extend, do not rebuild) — storage subset

| Capability | Status | File:line |
|---|---|---|
| Per-tenant isolated store + **hard storage cap** (`pin` refuses past the cap **before** writing any bytes) | **REAL + tested** | `packages/meerkat-relay/src/seeder-node.ts:245-283` (cap check `:256-260`); `PinResult` reason `'storage_cap'` `:127`; per-tenant provision cap `hosted-node.ts:63-82` (cap `:73`) |
| Per-piece **hash verification** on serve (a corrupted/forged piece is never handed out) | **REAL** | `seeder-node.ts:301-318` (verify `:313`) |
| **Retention engine**: auto-delete-unless-pinned `sweep` + per-tenant `autoDeleteDays` (default 30) | **REAL** | `seeder-node.ts:325-336`; `hosted-node.ts:42,74` |
| **Real per-subject usage rows** (`storageBytes`/`storageCapBytes`/`bytesServed`/`peersServed`) | **REAL** | `SeederNodeStats` `seeder-node.ts:129-138`; `HostedTenantStats` `hosted-node.ts:45-47,125-131` |
| **Cost-plus per-GB ledger** (storage 2¢/GB-mo, egress 1¢/GB, +25% take), self-flagged illustrative | **REAL engine, placeholder $** | `hosted-pricing.ts:15-24,59-64,82-137` |
| Tenant **zero-knowledge** store (operator holds no keys; stored bytes are opaque ciphertext) | **REAL + tested** | `hosted-node.ts:9-13,104-113` |
| `@mylife/sync` content-addressed **blob primitives** (chunk split, hash verify, blob policy) | **REAL** | `packages/sync/src/blob/{blob-store,blob-sync,blob-policy}.ts` (archive 09 baseline `:222-226`) — extend, do **not** parallel-wire |

### Net-new (this part builds it)

| Net-new | Surface |
|---|---|
| Resumable **multipart UPLOAD ingest** API into a tenant store: `POST /api/storage/upload` (authorize → subject → tenant) writing opaque hash-addressed blocks, **cap-checked before each block**, **per-block hash verify on receive** (mirrors `servePiece` verify), resume by a stored-block bitfield | `packages/meerkat-relay` (new `storage-ingest.ts` + `hosted-api.ts` route) |
| `@mylife/sync` **resumable upload-manifest** helper (block list, byte offsets, per-block hash, completed bitfield) reusing existing blob chunking/hash — **no new crypto** | `packages/sync` |
| Mobile **background `URLSession` upload** task (server-upload continuation only, never a P2P socket) + web resumable upload; both drive the manifest | `apps/meerkat`, `apps/meerkat-web` |
| **Retention tier** as a billing dimension (`rolling30` vs `forever`) mapped onto seeder `autoDeleteDays` / `isPinned` | `packages/meerkat-relay` |
| **[SUPERSEDED by the 2026-07-05 pricing lock; struck 2026-07-06]** No metered overage SKU, no separate `meerkat_hosted_storage` SKU, no yearly SKU — storage is bundled into the single $4.99/mo hosted price. Over-cap behavior is a product limit (reject-before-write, honest meter), not a new price. The **bring-your-own (self-host) zero-pay** path stays | `packages/meerkat-relay` |
| Net-new hosted feature `meerkat:hosted-storage` added to `MEERKAT_HOSTED_FEATURES` (`entitlements/src/meerkat-hosted.ts:13-16`) so the ingest path is gated by the **same fail-closed token** the relay already verifies | `packages/entitlements` |
| Extend `GET /api/usage/meerkat` with a **storage breakdown** (used/cap/overageGb/retentionTier) from `HostedTenantStats` | `packages/meerkat-relay` (extends the Part-2 route) |
| **Storage-pressure precheck** (device + tenant), **resume-after-crash** state persistence, **hash verification** after reassembly | both UIs + `packages/sync` |
| **Screen C — Storage** (upload picker, real progress from acked blocks, retention picker, overage meter, BYO link), all 5 states, both surfaces | `apps/meerkat`, `apps/meerkat-web` |

### Data model additions

**Client (device-local, `mk_` / `localStorage`, never replicated — same `maxScope = device_local` guard as Part 2):**

```
-- mk_settings NEW keys (caches/drafts only; the source of truth for what is stored is the tenant's real store rows):
'storage_upload_manifest_json'  -- in-flight resumable upload manifest (blockHashes, offsets, completed bitfield) for resume-after-crash
'storage_upload_target'         -- destination ref: { kind: 'community'|'dm'|'files', id?: string }
'storage_retention_pref'        -- 'rolling30' | 'forever'
'storage_usage_snapshot_json'   -- last real storage read (HostedTenantStats subset) for the partial/stale state
'storage_usage_fetched_at'      -- ISO string when that snapshot was read
```

Web mirrors these in `localStorage` (`meerkat_storage_upload_manifest`, `meerkat_storage_usage_snapshot`). The **sync-policy guard (extends TC-8)** asserts no storage key name appears in any synced table or sync prefix map.

**Server (hosted-service DB, never the zero-knowledge relay):**

```sql
-- meerkat_hosted_subscriptions: NET-NEW storage fields (alongside the Part-2 `tier`), webhook-driven:
retention_tier TEXT NOT NULL DEFAULT 'rolling30',  -- 'rolling30' | 'forever'  (maps to seeder autoDeleteDays / isPinned)
storage_overage_gb INTEGER NOT NULL DEFAULT 0      -- real metered GB over the free cap, reported to Stripe usage records
```

Uploaded blocks are **opaque, hash-addressed ciphertext** in the tenant `SeederPieceStore` (`FileSeederPieceStore` in prod); the operator holds **no keys** (`hosted-node.ts:9-13`). Storage "used" is **real stored bytes** (`store.sizeBytes()` via `SeederNodeStats.storageBytes`), never a counter.

### Protocol / engine changes in @mylife/sync (no new crypto)

- Reuse the existing blob chunking + content-addressed hashing; add a **resumable UPLOAD manifest** (the mirror of the existing download/serve manifest): a block list with per-block hash, byte offsets, and a completed-block bitfield, so an interrupted upload resumes from the first missing block (archive 09 line 198 "Always write transfer state before sending each chunk batch so the app can resume after crash or suspension"; archive 10 USM-1309 line 492 "resume after app crash, network loss, and server restart").
- **Encryption is unchanged.** The app seals each block with the existing community/DM content key **before** the byte leaves app memory; the hosted store receives only ciphertext (zero-knowledge preserved, `hosted-node.ts:9-13`). **No crypto is added here**; we extend `packages/sync`, never reimplement in the app.
- **Per-block hash verify on the RECEIVE/ingest side** mirrors `servePiece`'s per-piece verify (`seeder-node.ts:313`): a block whose bytes do not match its advertised hash is rejected and never stored, so a corrupted or forged block cannot poison the store.
- **Multipart grouping**: local-IP / server-upload routes group blocks into ~1 MB upload parts (archive 09 line 143 "Local IP and relay may group chunks into 1 MB upload/download parts"); the default logical block stays 256 KB (archive 09 line 142).

### Honesty contract for huge-file storage (non-negotiable, extends the plan-level contract)

- **Never gate local/LAN/self-host/BYO file movement behind storage billing.** A 10 GB LAN transfer or a self-hosted/BYO upload is free at every size; only hosted server ingest past the free cap is metered (extends NC-1). A lapsed storage subscription stops **new** hosted ingest past the free tier but never deletes already-stored or locally-created content.
- **Storage "used" is real stored bytes** from `store.sizeBytes()` via `SeederNodeStats` / `HostedTenantStats`, never a client-side counter or a fabricated "0 of 1 TB" (extends NC-4). No hosted node deployed/connected → Screen C shows **"Not connected"** + LAN/self-host/BYO only (ties AC-5).
- **Upload progress is honest.** "Stored" reflects blocks the server actually **acked by hash**, never a timer or an optimistic local estimate (transport-honesty rule; mirrors the WebRTC "connected only from real state" discipline).
- **Storage-pressure precheck** blocks an ingest the device cannot stage or the tenant cap cannot hold, **before** any bytes move (archive 09 lines 192–193; seeder `pin` `storage_cap` `:127,256-260`). The cap is enforced **server-side** by ingest/pin rejection, not by the UI.
- **Background `URLSession` is server-upload continuation only**; it is never a backgrounded P2P socket (archive 09 lines 70, 116–117).
- **Retention is honest.** A "rolling 30-day" tier really auto-deletes via `sweep` (`:325-336`); a "forever / pinned" tier really sets `isPinned` so `sweep` keeps it. The UI never claims permanence the retention policy does not enforce.
- **Overage dollars are illustrative until real invoices land** (`hosted-pricing.ts:107,133-135`): the metered per-GB rate gates on the `illustrative` flag exactly like the tier prices; the free-tier cap and the cost-plus policy are real, the dollar amount is not.
- **Over-1 TB is explicitly out of scope** (honest hard cap), matching archive 09's "Over 10 GB: future large-transfer mode" framing escalated to the 1 TB archive ceiling.

### UI: Screen C — Storage (both surfaces, all 5 states)

**Mobile:** a "Large files & archive" detail route off the Part-2 "Server space" panel (`settings.tsx` hosted services). **Web:** a Storage subsection inside `HostedServicesSection.tsx`. Open Burrow tokens; copy byte-aligned (device↔browser).

- **Picker:** choose a file → choose destination (community channel | DM | files) → choose retention (Rolling 30 days | Keep forever).
- **Meter (real rows only):** "Storing **{usedGB}** of **{capGB} GB**" + "{overageGb} GB over free tier ({rate}/GB-mo)" shown **only** when over and **only** when pricing is real; egress + peers from `HostedTenantStats`.
- **Actions:** "Upload", "Add storage" (metered monthly/yearly), "Use my own server" (BYO, no pay), "Manage billing".
- **Illustrative notice:** when `illustrative: true`, render `pricingLedger().notice` verbatim (`hosted-pricing.ts:133-135`); the overage rate is hidden/disabled, never shown as final.

| State | What the user sees | Trigger |
|---|---|---|
| Loading | "Preparing upload…" / "Reading your storage…" skeleton | Manifest build or usage fetch |
| Empty / Not connected | "No hosted storage connected. Same-Wi-Fi and self-host file sharing are free. Connect a hosted server to upload large files here." (no meter) | No hosted API/relay configured or deployed |
| Error | "Upload interrupted — we saved your progress." + Resume; or "Couldn't read storage — last reading {time}." + Retry | Block rejected / network drop / fetch fail |
| Success | Real meter + "Stored. {n} blocks verified." | All blocks acked + hashes verified |
| Partial | "Resuming from block {k} of {N}…" (real completed bitfield) | Interrupted upload resumed from the saved manifest |

---

## Acceptance Criteria

### User-facing (AC)

- [ ] **AC-1:** A fresh install can browse public content with **no** purchase and **no** payment wall.
- [ ] **AC-2:** Tapping a gated create/DM/community/sync action while locked opens the Unlock screen showing the **store's** price.
- [ ] **AC-3:** Completing the $4.99 purchase unlocks all private/local/device-to-device features immediately and persistently.
- [ ] **AC-4:** Restore unlocks on a second device under the same store account without a second charge.
- [ ] **AC-5:** With no hosted server configured/deployed, Server space shows **"Not connected"**, never a meter.
- [ ] **AC-6:** With a hosted server connected, the meter shows **real** used/cap/egress/peers from server rows.
- [ ] **AC-7:** Add-more-space launches a real Stripe Checkout; on success the meter's cap increases (real re-provision).
- [ ] **AC-8:** A lapsed subscription leaves locally created content fully usable; only hosted space drops to free tier.
- [ ] **AC-9:** Mobile and web present identical copy/states (parity), differing only "device"↔"browser".
- [ ] **AC-10:** When pricing is illustrative, the UI says so and does not present placeholder dollars as final; the one-time unlock price remains real.
- [ ] **AC-11:** The cross-rail boundary is stated in honest copy (a web purchase does not auto-unlock iOS/Android, and vice-versa), and an **optional Link code** flow unlocks the other rail after server-side receipt validation; without linking the other rail stays locked, and with no connection server the UI says linking is unavailable.
- [ ] **AC-12:** A file shared over LAN or to a self-hosted/BYO server uploads at **any** allowed size with **no** payment wall; only hosted ingest past the free cap is metered, and a lapsed storage subscription never deletes stored or locally-created content.
- [ ] **AC-13:** An interrupted huge-file upload **resumes from the first missing block** after app kill, network drop, or relaunch (never restart-from-zero), and the final content is **hash-verified** before it is considered stored.
- [ ] **AC-14:** Screen C's storage meter shows **real** used/cap/overage/egress from server rows; with no hosted storage connected it shows **"Not connected"**, never a fabricated "0 of N".
- [ ] **AC-15:** Files over **1 TB** are refused with an honest "out of scope" message; 10 GB–1 TB route to **hosted archive ingest only** (never phone-to-phone), and the chosen route is shown.

### Technical (TC)

- [ ] **TC-1:** `meerkat_app_unlock` exists in `@mylife/billing-config` as `{ type: 'one_time', price: 4.99 }`; `MEERKAT_HOSTED_MONTHLY_PRODUCT` no longer equals 4.99; a yearly SKU exists. The existing 4.99 SKU assertion in `packages/meerkat-relay/src/__tests__/hosted-api.test.ts:94,116` is updated to the repriced value (plus any `billing-config` SKU tests).
- [ ] **TC-2:** `deriveMeerkatAppUnlock(purchases)` is pure, returns locked for empty/invalid input, unlocked only for a real active `meerkat_app_unlock` purchase.
- [ ] **TC-3:** `createMeerkatHostedApiHandler` is **instantiated** by a runnable bin/server with concrete `StripeMeerkatBillingClient`, `SqliteMeerkatBillingStore`, `authorize()` (no longer only barrel-exported — `hosted-api.ts:289`).
- [ ] **TC-4:** `GET /api/usage/meerkat` returns the **subject's own** tenant stats only; cross-subject access returns the requester's own data (structural isolation, `hosted-node.ts:109-113`).
- [ ] **TC-5:** `GET /api/entitlements/meerkat` issues a token only for an active subscription, else `402` (`hosted-api.ts:238-244`); the relay accepts that token and **rejects** an expired/forged one fail-closed (`server.ts:182-189`).
- [ ] **TC-6:** Free-tier cap and paid cap are enforced server-side by `storage_cap` pin rejection (`seeder-node.ts` PinResult `storage_cap`), not by the UI.
- [ ] **TC-7:** Mobile passes the entitlement token to `connectRelayPeer` **only** when the configured relay equals the first-party hosted relay; omitted otherwise.
- [ ] **TC-8:** No billing/entitlement key appears in any sync prefix map or replicated table (guard test).
- [ ] **TC-9:** The hosted price gates on `illustrative`; `formatCents`/ledger drive the displayed dollars (`hosted-pricing.ts:139-142`).
- [ ] **TC-10:** `POST /api/link/meerkat-app` validates the proof **server-side** (Stripe row, or App Store Server API / Google Play Developer API for a store receipt) before minting a Link code; `GET /api/entitlements/meerkat-app?link=<code>` unlocks only for an active, unconsumed, unexpired code and returns locked for consumed/expired/forged codes (fail-closed). The Link code appears in no sync prefix map (extends TC-8).
- [ ] **TC-11:** The resumable upload manifest (block list + byte offsets + per-block hash + completed bitfield) lives in `@mylife/sync` (extends existing blob chunking/hash), **not** in the app; **no crypto is added** — each block is sealed with the existing content key before upload.
- [ ] **TC-12:** The ingest endpoint **rejects a block whose bytes do not match its advertised hash** and never stores it (mirrors `servePiece` verify, `seeder-node.ts:313`); a forged/corrupted block returns an error, fail-closed.
- [ ] **TC-13:** Hosted ingest is **cap-enforced server-side**: a block that would exceed the tenant `storageCap` is rejected (`storage_cap`, `seeder-node.ts:127,256-260`), independent of the UI.
- [ ] **TC-14:** The metered overage rate is **derived from the cost-plus ledger** (`storageGbMonthCents` + markup) and gates on `illustrative` (`hosted-pricing.ts:107`); reported metered usage equals **real stored GB** from `HostedTenantStats` (no synthetic counter).
- [ ] **TC-15:** `meerkat:hosted-storage` is added to `MEERKAT_HOSTED_FEATURES` (`entitlements/src/meerkat-hosted.ts:13-16`) and the ingest path verifies it **fail-closed** via the same token the relay checks; no storage key appears in any sync prefix map (extends TC-8).

### Negative (NC)

- [ ] **NC-1:** Local/LAN/self-host use is **never** blocked by the server-space subscription or its lapse.
- [ ] **NC-2:** No code path sets `unlocked: true` from a cache/synced/imported value without a real store/account validation.
- [ ] **NC-3:** The zero-knowledge relay `/healthz` and `env` paths gain **no** billing fields (`server.ts:120-132`, hub invariant).
- [ ] **NC-4:** No usage meter renders a number that is not sourced from a real `Stats` row; "Not connected" is shown instead of `0 of N`.
- [ ] **NC-5:** The entitlement **secret** and webhook secret never ship to a client bundle (env-only on the hosted service).
- [ ] **NC-6:** Billing rows never gain a `syncPolicy` that allows scope above `device_local`.
- [ ] **NC-7:** No local/LAN/self-host/BYO file movement is ever blocked by storage billing or its lapse (extends NC-1); a lapsed storage subscription stops new hosted ingest past the free tier but never deletes already-stored or locally-created content.
- [ ] **NC-8:** No upload reports "stored" from a timer or optimistic estimate; "stored" comes **only** from server block-hash acks, and no storage meter renders a number not sourced from a real `Stats` row (extends NC-4).
- [ ] **NC-9:** Background `URLSession` is used only for server upload/download continuation, never as a backgrounded peer socket; huge-file ingest never weakens the zero-knowledge store (operator holds no keys).

---

## Phased, test-FIRST BUILD plan (TDD)

> Each phase: write/adjust tests first (red), implement (green), run `pnpm gate:function:changed`, then `/review`. UI phases add `/browse` on the affected route across all 5 states.

### Phase 0 — Reconcile the money model (config + entitlements)
1. **Test-first:** update `packages/billing-config` tests for the new `meerkat_app_unlock` (`one_time`, 4.99), reprice `MEERKAT_HOSTED_MONTHLY_PRODUCT` off the ledger (no longer 4.99), add `meerkat_hosted_yearly`. The hard-coded 4.99 assertion that actually breaks lives in `packages/meerkat-relay/src/__tests__/hosted-api.test.ts:94,116` (`'creates a checkout session for the $4.99 Meerkat hosted monthly SKU'` + `price: 4.99`) — update that test to the repriced ledger value (and rename the case), in lockstep with the config change. Add a comment marking `PRODUCTS.standaloneModules` as hub-only, unrelated to Meerkat.
2. **Test-first:** new `packages/entitlements/src/meerkat-app.ts` — `MEERKAT_APP_UNLOCK_FEATURE`, `deriveMeerkatAppUnlock(purchases): { unlocked; purchaseDate }`. Unit tests for empty/invalid/active/refunded.
3. **Update** `apps/meerkat/app/__tests__/app-config.test.ts:73-77` (the `react-native-purchases` assertion at `:75`) — flip it: mobile now **declares** `react-native-purchases` (and keep `expo-calendar` absent). Document why (intentional invariant change).
4. Implement; gate; review.

### Phase 1 — Real server-space metering + serving path
1. **Test-first:** add a tier→cap map + a `usageForSubject(subjectId)` that reads `HostedNodeService.stats()` (`hosted-node.ts:125-131`) and returns the subject's tenant subset; free-tier provisioning.
2. **Test-first:** `GET /api/usage/meerkat` route in `hosted-api.ts` (authorize → subject → usage), 401 unauth, returns only own stats.
3. Implement; gate; review. (Tier C e2e added in Phase 5.)

### Phase 2 — Stand up the hosted billing service (deploy artifact)
1. **Test-first:** `StripeMeerkatBillingClient` (checkout subscription + one-time app, portal, `parseWebhook` with signature verify), `SqliteMeerkatBillingStore` (subscriptions + app_purchases), `authorize()` (bearer/device-signed). Fake-Stripe integration tests against `handleMeerkatHostedApiRequest`.
2. **Test-first:** one-time app-unlock checkout route + `GET /api/entitlements/meerkat-app` (account restore for web), webhook upserts both subscription and app-purchase, tier change raises tenant cap. **Cross-rail link (F1):** `POST /api/link/meerkat-app` (server-side receipt validation via App Store Server API / Google Play Developer API, or existing Stripe row) mints a single-use expiring `meerkat_app_links` code; `GET /api/entitlements/meerkat-app?link=<code>` redeems it fail-closed (consumed/expired/forged → locked). Extend the `MeerkatHostedSubscription` interface with the net-new `tier` field here.
3. **Build the second image** `Dockerfile.hosted` (composes hosted-api + `HostedNodeService`, needs `@mylife/sync` + a DATA_DIR volume — explicitly **not** the slim relay image, per `CLAUDE.md` "Deploy"), `deploy/` blueprint, env example (`ENTITLEMENT_SECRET`, `STRIPE_*`, `WEBHOOK_SECRET`, `DATABASE_URL`). Smoke test boots the real bin.
4. **Pricing-source op (documented):** replace `ILLUSTRATIVE_UNIT_COSTS.source` (`hosted-pricing.ts:59-64`) with real provider-invoice numbers; until then UI gates on `illustrative`. Gate; review.

### Phase 3 — Mobile IAP + gate + UI
1. **Test-first (pure):** mobile unlock-gate selector over a mocked `CustomerInfo`; `mk_settings` key read/write helpers; entitlement-token resolver (only for first-party hosted relay).
2. Add `react-native-purchases` (lazy-loaded like `lan-backend.ts`; null/locked when absent). Wire purchase/restore; on-device gate provider; gated-action interception.
3. Build **Unlock** screen (incl. **"Link this purchase"** / **"Enter link code"** cross-rail actions, disabled with honest copy when no connection server) + actionable **Server space** UI (all 5 states); wire real inputs into `hosted-boundaries.ts` (kill dead UI); wire token into `connectRelayPeer`.
4. Gate; `/browse` the unlock + server-space routes across all 5 states; review.

### Phase 4 — Web purchase + gate + UI (parity)
1. **Test-first:** web app-unlock state derivation; `MeerkatProvider` exposes unlock + `setEntitlementToken`/`clearEntitlementToken` (already present, `MeerkatProvider.tsx:330-331`) actions.
2. Web app-unlock purchase via Stripe one-time Checkout (reuses hosted service) + restore via `GET /api/entitlements/meerkat-app`; cross-rail **"Link this purchase"** / **"Enter link code"** parity actions (`POST /api/link/meerkat-app` + `?link=` redeem); gate.
3. Make `HostedServicesSection` actionable (usage meter, checkout/portal, enter token, restore); wire real boundary inputs.
4. Gate; `/browse`; review; run `/parity-check`-style copy/state diff vs mobile.

### Phase 5 — Honesty, pricing, parity, e2e
1. Tier-C multi-process e2e in `packages/meerkat-relay` harness: real hosted-service + real relay + real community node — subscribe→token→relay accepts→usage meter from real rows→lapse→relay fails closed→**local still works**; cap raise on upgrade; one-time unlock independent of subscription.
2. Cross-surface parity assertions; illustrative-flag gating verified; final `/review`.

### Phase 6 — Huge-file / archive storage (extends Part 2)
1. **Test-first (pure, `@mylife/sync`):** resumable upload-manifest helper (block list, byte offsets, per-block hash, completed bitfield, resume-from-first-missing) over existing blob chunking; storage-pressure evaluator; retention-tier → `autoDeleteDays`/`isPinned` map. Reuse existing hash; **add no crypto**.
2. **Test-first (`packages/meerkat-relay`):** `POST /api/storage/upload` multipart ingest (authorize → subject → tenant; per-block hash verify + reject; **cap-enforced** `storage_cap`; resume by stored-block bitfield) in a new `storage-ingest.ts`; extend `GET /api/usage/meerkat` with the storage breakdown; metered overage rate from the cost-plus ledger gated on `illustrative`; add the `meerkat:hosted-storage` feature to `MEERKAT_HOSTED_FEATURES`.
3. **Test-first (`packages/billing-config`):** metered storage SKU (`meerkat_hosted_storage` + yearly) and the retention dimension; webhook reports metered usage + sets `retention_tier`; BYO zero-pay path.
4. **Mobile:** background `URLSession` upload task driving the manifest (server-continuation only); **Screen C** all 5 states; storage-pressure precheck; resume-after-crash from the saved `mk_settings` manifest. **Web:** parity resumable upload + the Storage subsection in `HostedServicesSection.tsx`.
5. Gate; `/browse` Screen C across all 5 states (both surfaces); `/review`; extend the Tier-C e2e (real hosted-service + community node): upload → resume after kill from the bitfield → hash verify → cap reject past free tier → **local/LAN/BYO unaffected** → overage metered from real rows.

---

## Test Plan (unit / integration / e2e + verification tiers A–D)

| Layer | What | Reaches Tier |
|---|---|---|
| **Unit (A)** | `deriveMeerkatAppUnlock` (empty/invalid/active/refund); billing-config product shapes; tier→cap map; usage math; `formatCents`/ledger; entitlement-token resolver gating; sync-policy guard (no billing key replicated); **storage: upload-manifest resume math (resume-from-first-missing), storage-pressure evaluator, retention→`autoDeleteDays`/`isPinned` map, overage rate from ledger, storage-key sync guard** | **A** (fully automated, deterministic) |
| **Integration (B)** | `handleMeerkatHostedApiRequest` against fake Stripe client + in-memory store: checkout (sub + one-time), portal, webhook (sig verify + cap raise), `GET /api/entitlements/meerkat` (402 vs token), `GET /api/entitlements/meerkat-app`, `POST /api/link/meerkat-app` + `?link=` redeem (mint/consume/expire/forged fail-closed, fake store-receipt validator), `GET /api/usage/meerkat` (own-only, 401); mobile gate against mocked `CustomerInfo`; web gate against mocked restore; **storage: `POST /api/storage/upload` (per-block hash verify + reject, `storage_cap` over-cap reject, resume by bitfield), `/api/usage/meerkat` storage breakdown, metered SKU webhook (`retention_tier` + usage), `meerkat:hosted-storage` fail-closed gate** | **B** (automated, mocked external) |
| **E2E (C)** | Real hosted-service process + real relay + real community node via the existing multi-node harness (`packages/meerkat-relay` e2e): issue real signed token → relay accepts → forged/expired rejected fail-closed → real `storage_cap` enforcement → usage meter reads real `Stats` → subscription lapse drops to free tier, local unaffected; **storage: resumable upload into the tenant store → kill → resume from bitfield → per-block hash verify → over-cap reject → lapse stops new ingest, stored + LAN/BYO unaffected → overage metered from real rows** | **C** (automated multi-process, real crypto/transport) |
| **Manual / Ops (D)** | Real StoreKit + Play sandbox one-time purchase + restore on two devices; real cross-rail link with **production App Store Server API / Google Play Developer API** receipt validation keys; real Stripe **test-mode** checkout/portal/webhook end-to-end; App Store/Play review of the IAP; deploy the hosted-service image + flip `DEFAULT_RELAY_URL`; replace illustrative pricing with real invoices; anti-steering / external-purchase store-policy review; **storage: real 10 GB / 500 GB / 1 TB-simulation uploads on device via background `URLSession`, real metered Stripe usage reporting, object-storage / `DATA_DIR` volume sizing + retention `sweep` on the deployed image** | **D** (human/ops — cannot be automated) |

**What remains manual/ops after this plan:** real store sandbox + production purchase flows and store review (Apple/Google), real Stripe production keys + live webhook endpoint, the live deploy of the hosted-service image and `DEFAULT_RELAY_URL` flip (shared with the connectivity plan), and sourcing real provider-invoice pricing numbers. All are Tier-D by nature; the plan makes every code path that *feeds* them Tier-A/B/C testable.

---

## Risks + honesty landmines

| # | Landmine | Mitigation |
|---|---|---|
| L1 | Reusing one "$4.99" for two products (app vs hosted) | Distinct product IDs; **decouple** the hosted price from 4.99 (TC-1); comment the hub per-module $4.99 as unrelated |
| L2 | Faking a purchase in dev (RC sandbox / localStorage flag) | Gate derives from real receipt/verified account; Expo Go / no-module / no-store → **locked** (fail closed), public browsing still works (NC-2) |
| L3 | Showing a usage meter not from real rows | Meter reads `SeederNodeStats`/`HostedTenantStats` only; no hosted node → "Not connected", never `0 of N` (NC-4, AC-5) |
| L4 | Gating local/private behind the recurring subscription | Two independent entitlements; lapse never re-locks local content (NC-1, AC-8) |
| L5 | Presenting illustrative pricing as final | UI gates on `illustrative`; honest placeholder notice; only the real one-time price stays enabled (AC-10, TC-9) |
| L6 | Cross-device restore via mesh (replay attack) | Restore only via store/Stripe; billing rows stay `device_local`, never synced (NC-2, NC-6, TC-8) |
| L7 | Web "purchase" that just sets a flag | Web unlock verified via Stripe/account `GET /api/entitlements/meerkat-app` (NC-2) |
| L8 | Implying one buy covers both rails, or bridging rails over the mesh (replay) | Cross-rail is **opt-in, server-mediated** Link codes with server-side receipt validation; honest copy states the boundary; Link code never syncs and is fail-closed (F1, AC-11, TC-10, NC-2/NC-6) |
| R1 | App Store anti-steering / external-purchase rules | iOS app-unlock via StoreKit IAP; route web users to web checkout; follow current Apple "reader/external link" rules — Tier-D review item |
| R2 | Flipping the no-IAP invariant test breaks Expo Go | `react-native-purchases` lazy-loaded (lan-backend.ts pattern); gate locks gracefully without the native module |
| R3 | Hosted tier dishonest before relay deploy | Hard dependency on connectivity plan; until deployed, server-space = "Not connected" (depends-on) |
| R4 | Secret leakage | Entitlement + webhook secrets env-only on the hosted service; never in any client bundle (NC-5) |
| L9 | Faking a storage meter (optimistic "uploaded" before the server acks) | "Stored" only from server block-hash acks; meter from `HostedTenantStats`; not-connected → "Not connected" (NC-8, AC-14) |
| L10 | Gating local/LAN/BYO huge-file movement behind storage billing | Metered path is hosted ingest only; LAN/self-host/BYO free at any size; lapse never deletes stored/local content (NC-7, AC-12) |
| L11 | Reimplementing chunk crypto in the app for the upload path | Extend `@mylife/sync` blob chunking/hash; seal blocks with the existing content key; per-block verify mirrors `servePiece` (TC-11, TC-12) |
| L12 | Presenting illustrative overage dollars as final | Overage rate gates on `illustrative` like tier prices; free cap + cost-plus policy real, dollars not (TC-14, L5) |
| R5 | 1 TB+ scope creep / unbounded storage promise | Hard out-of-scope cap above 1 TB; 10 GB–1 TB hosted archive ingest only, never phone-to-phone (AC-15) |

---

## Sequencing / dependency note vs the other Meerkat launch plans

This is **plan 22 (monetization + billing)**. Relative to its sibling launch plans:

- **Theme system** — independent. This plan consumes Open Burrow tokens; no ordering constraint. (When the multi-preset theme system lands, the new Unlock/Server-space screens inherit it for free.)
- **Public social layer** — **soft depends-on.** It defines the *free-to-view* boundary; the app-unlock gate must exempt exactly those public-view features. Coordinate the gate's feature list with that plan's public surface. This plan does **not** gate public viewing.
- **Connectivity + self-hosting** — **hard depends-on.** The freemium server-space tier is only honest once a real relay + community node are deployed and `DEFAULT_RELAY_URL` is set; and the "use my own server instead" no-pay path is that plan's non-technical self-host UI. Part 1 (one-time unlock) can build **before** this; Part 2 must land **after** (or in lockstep with) the deploy.
- **Full DMs** — **soft depends-on.** DMs are a private/create feature behind the one-time unlock; include them in the gate list. Independent of the billing backend.
- **Huge-file / archive storage (Part 3)** — **extends Part 2** (same tenant rows, same cost-plus ledger). Its **destinations** (community channel, DM thread) are owned by Public social (plan 19) and Full DMs (plan 21); Part 3 owns only the storage ingest + retention + metered billing. Hard-depends on the deployed hosted service, like Part 2.
- **Launch readiness** — **this plan blocks it.** Launch certification needs: reconciled pricing, IAP approved, hosted service deployed, real invoices in, and the honesty ACs green.

**Recommended global order:** Connectivity (deploy relay) → Public social (free-view boundary) → **Monetization Part 1 (unlock, parallelizable early)** → **Monetization Part 2 (server-space, after deploy)** → Full DMs (gate list) → **Monetization Part 3 (huge-file storage, after Part 2)** → Launch readiness.

### Merge-surface overlap + ownership (X1, critical)

This plan edits two files that **plans 19 and 20 also touch** on both surfaces — coordinate by row-key ownership and land in dependency order to avoid clobbering:

| Shared file | Plan 20 (connectivity) | Plan 19 (public-social) | Plan 22 (this) |
|---|---|---|---|
| `apps/meerkat/app/(root)/data/hosted-boundaries.ts` (+ web mirror) | connection / free-tier rows `:41-78` (`hostedRelayItem` free default) | `public_posts`/`public_feed` rows `:96-109` (state-driven) | **kills the dead `paid_required`/`included` branches** by passing real `hostedRelayUrl`/`hasHostedRelayEntitlement` (`:41-61`); adds the **Server-space** billing rows |
| `apps/meerkat/app/(root)/(tabs)/settings.tsx` (+ web `TransportSection.tsx`/`HostedServicesSection.tsx`) | Connection card / adopt / host entry `:314-334` | (boundary rows render here) | **Server-space** actionable panel inside "Hosted services" `:314-320` |

**Ownership rule:** each plan owns **distinct row keys / sub-sections** of these files; no plan rewrites another's rows. **Merge order: 20 → 19 → 22.** Land connectivity first (it stands up the real serving path + the connection card and the free-tier boundary rows), then public-social (its `public_*` rows), then this plan **last** so it composes real `hostedRelayUrl` + entitlement inputs onto an already-state-driven boundary matrix. If 22 lands before 20/19, gate its `hosted-boundaries.ts` edits behind feature-detection of the connection inputs so it never fakes a connected state (ties to AC-5 "Not connected").

---

## Handoff State

**Before:** `$4.99` is display copy with three conflicting meanings; no IAP SDK (asserted absent); dead `paid_required`/`included` boundary UI; the Stripe billing API is a library never instantiated; the hosted-node runtime + pricing ledger + entitlement crypto are real but unwired to any UI or deploy; no usage metering surfaced; web has token plumbing but no UI to acquire/enter it; mobile has no entitlement plumbing into the engine connect path. **For storage:** the hosted node can `pin`/serve a community catalog (cap-enforced, hash-verified, `sweep` retention) but has **no resumable upload-INTO-store endpoint**, no retention-tier billing, and no metered storage overage — `egressGbIncluded` even carries an explicit "overage pricing is future work" note (`hosted-pricing.ts:31-32`).

**After:** one canonical `meerkat_app_unlock` ($4.99 one-time) with real purchase/restore + on-device gate on both surfaces; an explicit, honestly-documented cross-rail boundary plus an optional server-mediated **Link code** (`POST /api/link/meerkat-app` with server-side receipt validation) so a single purchase can cover both the Stripe (web) and StoreKit/Play (mobile) rails without a second charge; a deployed hosted-service image instantiating the Stripe billing API with concrete client/store/authorize; `GET /api/usage/meerkat` serving real per-subject server-space usage; freemium free tier + monthly/yearly overage with real cap enforcement; actionable Server-space UI (all 5 states) reading real rows; dead boundary UI killed by real inputs; mobile entitlement token wired into `connectRelayPeer` for first-party hosted relays only; pricing gated on the illustrative flag with a documented op to source real invoices. **For storage:** a resumable multipart ingest pipeline (10 GB–1 TB) writing opaque hash-addressed blocks into the per-tenant store (cap-enforced, per-block verified, resume-after-crash, background `URLSession` on iOS); retention tiers (rolling-30 vs forever) mapped onto the seeder `sweep`; metered storage overage billing past a real free cap with a bring-your-own zero-pay path; a Screen C storage UI (all 5 states) reading real rows; and a net-new `meerkat:hosted-storage` feature gated by the same fail-closed token. Local/LAN/self-host/BYO file movement stays free and ungated at any size; storage "used" is always real stored bytes; nothing faked.

**Key files to touch:** `packages/billing-config/src/index.ts`; `packages/entitlements/src/{meerkat-app.ts (new), index.ts}`; `packages/meerkat-relay/src/{hosted-api.ts, hosted-node.ts, hosted-pricing.ts}` + new `bin/meerkat-hosted-service.mjs` + `Dockerfile.hosted` + `deploy/`; `apps/meerkat/app/(root)/(tabs)/{settings.tsx, upgrade.tsx (new)}`, `app/(root)/data/{hosted-boundaries.ts, sync-core.ts, db.ts}`, new IAP/gate provider + `app/__tests__/app-config.test.ts`; `apps/meerkat-web/src/lib/{hosted-access.ts, MeerkatProvider.tsx}`, `src/ui/settings/HostedServicesSection.tsx` + app-unlock screen; `packages/sync` entitlement-token wiring + a resumable upload-manifest reusing existing blob chunking/hash (no new crypto). **Part 3 storage adds:** `packages/meerkat-relay/src/{storage-ingest.ts (new), hosted-api.ts (storage route), hosted-pricing.ts (overage), hosted-node.ts}`; `packages/entitlements/src/meerkat-hosted.ts` (`meerkat:hosted-storage` feature); `packages/billing-config/src/index.ts` (metered storage SKU + yearly); `apps/meerkat` background-upload task + Screen C; `apps/meerkat-web` resumable upload + Storage subsection.

**gstack gates (Complexity = Complex):** `/office-hours` (builder) before finalizing → `/plan-eng-review` on this spec → build phased → `/function-gate-runner` + `/review` each phase → `/browse` on Unlock + Server-space + **Storage (Screen C)** (all 5 states) → `/qa` on the settings/billing surface → `/parity-check` copy/state diff → `/domain-engine-benchmarker` on `deriveMeerkatAppUnlock` + pricing engine + **the resumable upload-manifest / storage-pressure engine**.

## Status Delta (2026-07-04)

- Only Stage 0 exists as of the 2026-07-04 production audit.
- `MeerkatHostedBillingClient` is interface-only; no Stripe implementation.
- No IAP SDK, product, or paywall in the mobile app; the $4.99 price is display copy only.
- billing-config still carries a conflicting $4.99 MONTHLY hosted product vs the one-time unlock.
- Everything past Stage 0 remains codeable.
