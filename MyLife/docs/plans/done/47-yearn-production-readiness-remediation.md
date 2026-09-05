# Plan 47 — Yearn Production-Readiness Remediation

**Created:** 2026-07-11
**Owner:** Yearn / founder
**Source audit:** `docs/reports/REPORT-yearn-adversarial-production-audit-2026-07-11.md`
**Verdict being remediated:** NO-GO. Regressed E2EE trust guarantee, chat crash path, broken on-device auth, non-reproducible backend schema, zero legal/moderation infra, fabricated-success UI.

## Scope

Bring `apps/yearn` from "core loop works, not shippable" to a defensible public TestFlight/App Store dating launch. Phase 1 is code-level and executed immediately. Phases 2–5 need hosted-infra access, founder product decisions, legal content, and App Store Connect credentials.

## Progress (2026-07-11, branch `feature/yearn-production-readiness`)

Landed and verified (tsc clean, 134/134 tests; iOS export green for the foundational changes):

- **Phase 1 (complete)** — `020f8654`: Y1 receive-path sender-key binding, Y3 PKCE, Y4 CSPRNG, Y6 fail-closed pin, B1 crash+ErrorBoundary, B2 effect deps, B3 deck index, B4/U6 durable echo store, B7 selection reconcile, removed Star/Boost, gated verified badge, removed mic+contacts permissions, honest verify copy, deck a11y.
- **Phase 3 (partial)** — `2863d25b`: Terms + Privacy + Community Guidelines (zero-tolerance, block/report/24h-action, NCMEC reference) in `apps/yearn/legal/`; consent line on the age gate; Legal section on the You tab. Founder still owns hosting the site + App Store Connect Privacy URL + 18+ rating.
- **Phase 4 (partial)** — `7a7d717c`: realtime chat updates for the open conversation (Supabase Realtime), graceful fallback to manual refresh. Hosted follow-up: enable Realtime on `yearn.messages_ciphertext`.
- **Phase 2 (partial)** — `605fd9d5`: relocated the 13 canonical `yearn` base migrations into the repo (`20260525*`) so the schema is reproducible; exposed `yearn` in `config.toml`. Founder/ops follow-up: `supabase db reset` verification + hosted migration-history reconciliation.
- **U2** — `e8b7974e`: onboarding draft persistence (survives app kill).
- **U10** — `efbdfcc1`: haptics on like/pass/match.
- **Phase 2 item 3 / boost integrity (complete in repo, 2026-07-11)** — plan 50, branch `feature/yearn-boost-integrity`: migration `20260712000001` drops client-callable `activate_boost`, adds a partial unique index on `original_transaction_id` and a service-role-only `grant_boost`; new `yearn-activate-boost` edge function validates transactions against the App Store Server API and fails closed without Apple credentials. Opus red-team verdict SHIP. Founder ops: hosted apply, function deploy, Apple IAP secrets. See `docs/plans/done/50-yearn-boost-integrity.md`.

Still open (need founder/ops/hosted/credentials): Y2 multi-device E2EE; photo signed-URL definer RPC + unmatch revoke; per-recipient rate limit; moderation action path + minor-safety escalation ops; push notifications; geolocation/PostGIS; filters; RevenueCat monetization; verification/NSFW pipeline; live hosted-DB verification checklist.

## Status Delta (2026-07-12, verified against main `6f8e6545`, branch `feature/yearn-plan47-phases-2-5`)

Written by the plan-47 phases 2-5 orchestrator after re-verifying every claim above against merged main (merge `14df25e6` landed the whole `feature/yearn-production-readiness` branch, not only Phase 1). Baseline re-confirmed in a clean worktree: `tsc --noEmit` clean, 134/134 yearn tests green.

### Corrections to the record

- Merge `14df25e6` is titled "phases 1-4" and matches the Progress section: Phase 1 complete plus partials of Phases 2, 3, and 4, plus U2/U10. The dispatch-board framing "Phase 1 merged" undersells what landed.
- W1 (boost integrity, plan 49) has NOT started: no `feature/yearn-boost-integrity` branch exists locally or on origin, and `activate_boost` still trusts the client. Per dispatch etiquette ("W1 before or inside W2"), boost integrity is absorbed into this session's Phase 2.
- All 19 yearn migrations (13 base `20260525*` + 6 patch `20260531*`) are in the repo and `yearn` is in `config.toml` exposed schemas. The Phase 2 items 1-2 reproducibility work is DONE except the hosted `supabase db reset` verification (founder-ops).

### Verified-open items (evidence on main)

- **Boost self-grant (Phase 2/W1):** `activate_boost` inserts with no receipt validation (`20260525000012_yearn_boost.sql:82-102`, comment admits client-trust) and `yearn.boosts.original_transaction_id` has no unique index (entitlements has the pattern to copy at `20260525000011:33-35`). No App Store Server API code anywhere in yearn; zero yearn edge functions exist.
- **Photo access (Phase 2):** `20260531000003` scopes reads to own folder OR any unpaused, non-blocked profile's `show_on_profile=true` photos. Not scoped to deck/matches; nothing revokes on unmatch/block beyond TTL expiry. Clients mint their own signed URLs.
- **Rate limits (Phase 2):** per-sender only (likes 120/hr `20260525000010:83-110`; messages 30/min `:112-137`; ciphertext twin in `20260531000005:111-131`). No per-(sender,recipient) cap, no supporting indexes for the rolling-window trigger scans.
- **Moderation (Phase 3):** `yearn.reports` has `status text default 'open'` with no CHECK, no action RPCs, no queue semantics, no auto-hide of reported profiles pending review (client removes them from the local deck only), no escalation/audit tables, no admin surface. Report categories include `underage` (client `DiscoverDeck.tsx:123-130`); guidelines commit to NCMEC reporting and a 24h action SLA with nothing behind either.
- **Push (Phase 4):** `yearn.device_tokens` + `register_device_token` exist and are dormant; client has no expo-notifications dependency, never registers tokens; no outbox, no sender. Sibling pattern: `supabase/functions/bestchef-push-fanout`.
- **Geo (Phase 4):** no location columns, no PostGIS, ranking is `has_active_boost desc, updated_at desc`. Client already carries optional `distance_bucket`/`distance_miles` Zod fields the RPC never returns, ships `expo-location` unused, and app.json + privacy manifest already declare coarse-location usage. Phase 4 must make those declarations true (or they are a store-review honesty defect).
- **Filters (Phase 4):** `discover_profiles(p_limit)` takes no filter params; onboarding captures identity/intent but no seek preferences (age range, distance, intent filter).
- **Monetization (Phase 5):** entitlements substrate is real (`upsert_entitlement` service-role-only, `current_membership`, unique txn index) but nothing populates it: no IAP client (`react-native-purchases` absent), no webhook, no paywall UI. Star/Boost UI removed honestly (`DiscoverDeck.tsx:935-938`).
- **Verification (Phase 5):** `YEARN_VERIFICATION_PIPELINE_LIVE = false` hard-gates the badge (`DiscoverDeck.tsx:66-70`). No selfie/liveness code. Honest as-is; pipeline still unbuilt.
- **Y2 multi-device E2EE:** still single-recipient-device (`intro_recipient_device_key` returns one key; envelope targets one `recipientDeviceId`). Remains open; scheduled inside Phase 4 realtime/messaging work only if scoped by the founder — it is a protocol change, tracked but not silently absorbed.
- **Realtime (Phase 4 residual):** wired for the open conversation's `messages_ciphertext` INSERTs only; match-list and incoming-like updates still manual. Hosted follow-up (enable Realtime on the table) is founder-ops.

### Founder-ops ledger (listed, never faked; all fail closed in code)

1. Host `apps/yearn/legal/` at `https://yearn.app/{terms,privacy,guidelines}` (links already render in-app).
2. Hosted DB: apply/reconcile the 19 repo migrations (`supabase db reset` parity check), enable Realtime on `yearn.messages_ciphertext`, run the live RLS/age/deletion verification checklist.
3. App Store Connect: 18+ rating, Privacy URL, reviewer demo account, EULA link, EAS `projectId`, APNs key provisioning, IAP products (boost consumable, membership), App Store Server Notifications V2 URL once the webhook ships.
4. Vendor onboarding: selfie/liveness verification provider and NSFW screening provider decisions; NCMEC reporting registration + designated reporter process.
5. RevenueCat project + API keys if RevenueCat (vs raw StoreKit) is chosen for membership.

## Status Delta (2026-07-30, verified against main `2f5f6e81`)

Ground-truth re-verification (full table: `docs/sessions/2026-07-30-yearn-plan47-ground-truth.md`). Baseline 204/204 yearn tests green.

- Phase 2 code scope is COMPLETE on main: boost integrity (plan 47 model, `20260712000001` + `yearn-boost-activate`), photo access scoping with unmatch revoke (`20260712000002`), per-pair rate limits + indexes (`20260712000003`). Item 6 remains founder-ops.
- Phase 3 server-side is COMPLETE on main via `20260712000004` (report lifecycle CHECK, `moderation_status` + deck/likes/matches exclusion, immutable `moderation_actions`, service-role `moderate_report`/`apply_moderation_action`, underage auto-hide + `safety_escalations` seam). Still open in Phase 3: an operational surface to run the queue (edge-function workflow), the mandated-reporting process runbook.
- Phase 4 open: push (client + outbox + sender fn; DB substrate dormant), realtime beyond the open conversation, geolocation/PostGIS (zero location columns; app.json already declares location - honesty defect until built), filters (`discover_profiles(p_limit)` unchanged).
- Phase 5 open: `activateBoost(signedTransaction)` exists in the repository layer with ZERO UI callers and no IAP client dependency; nothing populates entitlements; verification pipeline unbuilt (honestly gated). Server `appAccountToken` check is enforced only when the client sends one; tighten once the UI always sends it.
- Note: merge `c7b5b856` was titled "phases 2-5" but contained only the Phase 3 moderation migration; memory.md corrected 2026-07-30.

## Completion Delta (2026-07-30, branch `feature/yearn-plan47-remaining`)

Every remaining codeable phase item executed to full production grade in one session (commits `2c5b4db4..9de97441`, worktree isolated). All new behavioural tests mutation-checked. Yearn suite 318/318, tsc clean.

- **Phase 3 COMPLETE (code):** `yearn-moderation` edge function (admin-secret timing-safe auth over service-role RPCs; structurally cannot write `transmitted`), migration `20260730000001` (3+ distinct reporters/24h auto-hide for non-underage reports + list/get/advance ops RPCs), mandated-reporting runbook (`docs/guides/yearn-mandated-reporting-runbook.md`).
- **Phase 4 COMPLETE (code):** push end to end (migration `20260730000002` outbox + enqueue triggers with mutual-pair suppression, `yearn-push-fanout` Expo transport with token pruning and kind-only E2EE-safe payloads, client expo-notifications wrapper + You-tab master toggle); realtime for likes + matches (RLS-scoped subscriptions, publication wired in migration); geolocation (PostGIS `20260730000003`, definer `update_my_location`, coarse-only client capture behind explicit user action, distance ranking + buckets in `discover_profiles`, making the app.json location declarations true); seek filters (`discovery_prefs` + DiscoverFilters panel).
- **Phase 5 COMPLETE (code):** StoreKit 2 client (expo-iap) binding `appAccountToken` to the lowercased user id and sending the signed transaction JWS server-side BEFORE `finishTransaction`; `yearn-boost-activate` now REQUIRES `appAccountToken`; `yearn-membership-activate` + `yearn-appstore-notifications` webhook (dual chain-verified JWS, renewal/expiry/refund/revoke mapping, migration `20260730000004` owner lookup); MembershipSection paywall (server-truth state, store-localized prices only) + real BoostButton; verification pipeline (migration `20260730000005`: submissions + camera-only live selfie + human review via `yearn-moderation` + DB trigger making `is_verified=true` impossible without an approved submission; badge gate flipped live honestly; liveness vendor slot fail-closed).
- **Y2 multi-device E2EE** remains the one open protocol item, deliberately out of scope per the 2026-07-12 delta (founder-scoped protocol change, tracked, not silently absorbed).

### Founder-ops ledger (refreshed 2026-07-30; all fail closed in code)

1. Hosted DB: apply migrations `20260712*` and `20260730000001..5` (includes PostGIS, realtime publication for `messages_ciphertext`/`likes`/`matches`, pg_cron push worker); run the live RLS/age/deletion checklist; seed `yearn.job_config` (`functions_base_url`, `push_fanout_worker_secret`).
2. Deploy edge functions with secrets: `yearn-boost-activate`, `yearn-membership-activate`, `yearn-appstore-notifications` (`YEARN_APPSTORE_BUNDLE_ID`), `yearn-moderation` (`YEARN_MODERATION_ADMIN_SECRET`), `yearn-push-fanout` (`YEARN_PUSH_FANOUT_WORKER_SECRET`).
3. App Store Connect: 18+ rating, Privacy URL, demo account, EULA, EAS `projectId` (push tokens fail closed `not_provisioned` until set), APNs key, IAP products (`com.mylife.yearn.boost` consumable, `com.mylife.yearn.membership` yearly), App Store Server Notifications V2 URL pointed at `yearn-appstore-notifications`.
4. Host `apps/yearn/legal/` at yearn.app.
5. Safety ops: counsel + NCMEC ESP registration + designated reporter (transmission stays impossible until a separately authored migration); liveness + NSFW vendor selections (strengthen, never gate).
6. On-device two-account QA of the full loop including E2EE receive-path binding (overall GO criterion).

## Phase 1 — Code-level P0s (execute now, in this session)

Security, correctness, and honesty fixes with no external dependency. Each is unit-testable.

1. **Y1 — enforce sender-key binding on receive.** In `YearnSocialSurfaces.tsx`, TOFU-pin the sender's device key per `message.senderId` and pass `senderPublicKey` to `decryptYearnMessageForDevice`; on mismatch, surface a key-change warning instead of rendering. Add a decrypt-path test asserting a mismatched header key returns null / warns.
2. **Y3 — set `flowType: 'pkce'`** in `createYearnSupabaseClient` (`supabase.ts`). Add a construction test.
3. **Y4 — install a CSPRNG at entry.** Import a get-random-values polyfill (or `nacl.setPRNG` backed by `expo-crypto.getRandomBytes`) at the top of `app/_layout.tsx`; harden `shims/crypto.js` to fall back to `expo-crypto`. Add a keypair smoke test that runs without Node crypto.
4. **B1 — stop the chat crash.** Make `decryptYearnMessageForDevice` swallow its own parse errors and return null; wrap the render-time decrypt in try/catch; add a top-level ErrorBoundary in `app/_layout.tsx`.
5. **B2 — fix effect deps.** Add `userId` and `refreshToken` to the message-load effect; make Refresh re-fetch the open conversation.
6. **B3 — fix deck index.** Recompute `currentIndex` inside one functional update that knows the removed index and the new array length.
7. **U1/B5 — remove fabricated success.** Either gate Star/Boost off in production until wired, or make them honest (no success toast, no deck advance) until a backend path exists. Recommended: hide Boost behind the (unbuilt) paywall and make Star a local short-list with honest copy.
8. **B4/U6 — own messages readable.** Encrypt a self-copy (encrypt-to-self) or persist echoes durably so own history survives refetch.
9. **B7 — reconcile `selectedMatchId`** against the refreshed match list (drop if absent, fall back to first).
10. **Y6 — fail closed on unreadable pin** in `yearnKeyDirectory.ts` (distinguish "no pin" from "corrupt pin").
11. **Honesty fixes:** gate the `is_verified` badge off until a real pipeline exists; fix the microphone permission string in `app.json` to drop the in-app-calls claim; remove dev/TODO copy from the Verify onboarding step.
12. **Hygiene:** wire `expo-haptics` on like/pass/match/destructive actions; add `accessibilityState={{disabled}}` to `DeckActionButton`; either wire `CachedYearnRepository` or delete the dead offline layer (decision: keep + wire read-through for deck/matches, since it's fully tested).

**Gate:** `pnpm --filter @mylife/yearn-app typecheck`, full yearn vitest suite, `pnpm gate:function:changed` for changed logic. All must be green before commit.

## Phase 2 — Backend schema reproducibility + RLS hardening (needs hosted access)

1. Author the base `yearn` schema (tables, `is_blocked()`, all 12 RPCs) as tracked MyLife migrations so the schema is reproducible from one repo; remove the silent-skip guards or make them create-if-missing.
2. Add `yearn` to `supabase/config.toml` exposed schemas.
3. `activate_boost`: validate the App Store receipt server-side (edge function) + `unique(original_transaction_id)`. DONE in repo via plan 50 (migration `20260712000001` + `yearn-activate-boost` edge function, 2026-07-11); hosted apply and Apple IAP secrets are founder ops.
4. Photo reads: move cross-user signed-URL minting behind a definer RPC scoped to the caller's live deck/matches; revoke on unmatch.
5. Add a per-(sender,recipient) rate-limit cap; index the rate-limit count columns.
6. **Live verification checklist:** all native migrations applied in order; RLS ENABLED on every table; `profiles_min_age_18` VALIDATED; no `grant … to anon`; `delete_my_account` purges.

## Phase 3 — Trust & safety, legal, App Store compliance (launch-blocking)

1. Legal docs: Terms/EULA, Privacy Policy, Community Guidelines with a stated zero-tolerance policy; link from onboarding and settings.
2. Moderation action path: a queue + admin surface (or edge-function workflow) so reports can result in suspend/ban/content-removal; a report auto-hides content pending review.
3. Minor-safety reporting pathway: an escalation/takedown mechanism and a documented mandated-reporting process. (Architecture + ops; not detection logic.)
4. App Store Connect: correct 18+ age rating; reviewer demo account; accurate privacy nutrition labels; EULA link.
5. Confirm `is_verified` can never render true without a real review pipeline.

## Phase 4 — Core launch features (multi-week)

Push notifications (APNs/FCM + edge function) · realtime chat/match updates (Supabase Realtime, replace manual refresh) · geolocation capture + PostGIS distance ranking · hard/soft filters.

## Phase 5 — Monetization + verification

RevenueCat membership + boost paywall wired to `current_membership`/`activate_boost` (with Phase 2 receipt validation) · selfie/liveness verification pipeline driving the `is_verified` badge · optional NSFW image screening.

## Acceptance criteria

- Phase 1: all 12 items landed, gates green, no new tech debt, honest UI throughout.
- Phases 2–3: schema reproducible from repo; RLS/age/deletion verified on hosted; legal docs published and linked; reports actionable; correct age rating.
- Phases 4–5: push + realtime + geo shipped; monetization live with server-validated receipts; verification pipeline real before any verified badge shows.
- Overall GO requires: no Critical/High open in security, correctness, backend, or T&S classes; on-device two-account QA of the full loop including E2EE receive-path binding.
