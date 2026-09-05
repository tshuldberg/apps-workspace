# MyLife Portfolio Customer-Readiness Ruling

**Date:** 2026-07-05
**Scope:** Every application and module in the MyLife monorepo: 8 sellable product surfaces (Meerkat, BestChef, DoWork, Manhattan, Yearn, MyNews, MyLife Hub mobile, MyLife Hub web) and all 41 registry modules (full per-module table in Appendix A).
**Method:** 8 parallel read-only adversarial auditors (one per product/cluster), each verifying claims against code at HEAD (`fbef9997`, branch `feature/meerkat-launch-completion`, tree equivalent to main for all audited apps). Final rulings below are the synthesizer's adversarial decision, not an average of the agents.
**Standard applied:** "Ready for real customers" means a stranger can find, install or load, pay for, and successfully use the product today, with the legal and safety obligations of that product category met.

---

## Executive Summary

**Final ruling: 0 of 8 products are GO today. All 8 are NO-GO.**

That headline hides the real story: the portfolio's engineering quality is high and its honesty discipline (fail-closed, no fake connectivity, no fabricated status) held almost everywhere. What is missing is almost entirely the commercial shell around the code: billing, deployment, distribution, legal, and trust-and-safety. Two products also have genuine product-breaking code defects (DoWork, BestChef).

The single most important portfolio-wide fact: **there is currently no configuration in which any customer can pay you.** `packages/entitlements/src/test-mode.ts` hardcodes `_testMode = true` (everything free), and no payment SDK is installed in hub mobile, hub web, Meerkat, or BestChef. Only DoWork and Manhattan have real, guarded billing code paths, and both are waiting on RevenueCat products that do not exist yet.

### Verdict table (ranked by distance to GO)

| # | Product | Verdict | Headline blocker | Realistic distance to GO |
|---|---------|---------|------------------|--------------------------|
| 1 | **DoWork** | **NO-GO** | Core loop is dead: the live session never dispatches `START`, so no set can ever be logged | ~1-2 weeks (one small code fix + founder-ops F2-F8) |
| 2 | **Manhattan** | **NO-GO** (code is GO) | No EAS project, no RevenueCat products, no legal docs; native surface never run on a device | ~1 week of ops + device QA gate |
| 3 | **MyNews** | **NO-GO** | No production backend provisioned; every surface dormant by design | ~1 week of ops to a read-mostly beta; UGC gated on an unauthored trust spine |
| 4 | **MyLife Hub (mobile)** | **NO-GO** | Billing architecturally stubbed; 2 visible modules (Forums, Market) have no backend at all | ~2-3 weeks |
| 5 | **Meerkat** | **NO-GO** | Cannot build (Metro export blocker), cannot pay (no IAP), cannot connect (no relay deployed) | ~2-4 weeks |
| 6 | **MyLife Hub (web)** | **NO-GO** | Not hosted anywhere; single-user sqlite with no multi-tenancy; Stripe not installed | Product-shape decision, then 1-8 weeks |
| 7 | **BestChef** | **NO-GO** | Fabricated AI results shown to public users; no CSAM/NCMEC; $0 monetization against live per-user costs | ~3+ months (vendor procurement is the critical path) |
| 8 | **Yearn** | **NO-GO** (hard) | Dating app with no CSAM/NCMEC pipeline, no moderation loop, no in-chat safety, chat not live | ~7-9+ weeks; safety engineering is the long pole |

### Module fleet summary (41 registry IDs)

- **18 user-visible** (5 GA: budget, habits, health, meds, recipes; 13 public beta), **23 hidden**, minus overlap via a web-only visibility override that adds dining, manhattan, rsvp, sleep, sports on web.
- **13 visible modules are genuinely ship-ready** inside the hub: budget, habits, meds, books, mood, cycle, nutrition, stars, trails, workouts, garden, classes, travel (plus dining, rsvp, sleep on web).
- **2 visible modules are broken at the CRIT level:** Forums and Market are user-enableable public betas whose cloud backends were never deployed (schemas never left the module directories).
- **3 visible modules need fixes:** Health (GA) has a reachable "Coming soon" screen on a core action; Presence's headline screen-time tracking is a stub (its focus-session core is real); Sports (web) has an unverified live-scores dependency. Recipes (GA) carries a caution: its social/cloud screens tie into the BestChef backend, which has unresolved safety gaps.
- **Correctly gated:** payments (MyPay) verified sealed on both surfaces behind a dual-control release system; voice (hollow, no audio capture, must stay hidden); surf/homes (metadata drift + no backends); the rest of the hidden set is intentional.

---

## Part 1: Product Rulings

### 1. DoWork: NO-GO (closest to GO in the portfolio)

**Why.** A paid workout app whose one job, logging a set, is impossible in shipped code. The workout engine boots into `idle` (`modules/workouts/src/workout/engine.ts:44`), the only `idle -> playing` transition is `START` (`engine.ts:62-65`), `COMPLETE_SET` early-returns unless playing (`engine.ts:132`), and `apps/dowork/app/(root)/session.tsx:240` creates the player but never dispatches `START` anywhere in the app (zero grep matches repo-wide). "Mark Complete" is disabled outside `playing` (`session.tsx:874`). Verified present on main, on the launch branch, and on the current checkout.

**Correction to yesterday's walkthrough:** finding C2 (unmerged 11-commit fix wave) is stale. `git rev-list origin/main..origin/feature/dowork-trainer-launch` is 0; the wave is fully merged via `d8070864`. C2 is closed.

**Everything else is founder-ops:** RevenueCat products + keys (the `eas-build-pre-install` guard correctly refuses to produce a production build without them), ASC app id still `REPLACE_WITH_ASC_APP_ID` in `eas.json`, legal drafted in `apps/dowork/legal/` but not hosted at the hardcoded dowork.app URLs, APNs/FCM keys, icon art, and the white-glove device QA run. Supabase prod is live and verified. Trainer subscription ladder (8 RC tiers) is real and consistent.

**Resolution path:**
1. Dispatch `START` on live-session mount in `session.tsx` + regression test (codeable, well under a day). This single fix restores the product.
2. Triage the honesty findings before real users see them: Home fake volume math, Progress streak math, body-map muscle mapping, generator ignoring equipment (0.5-1.5 days).
3. Founder-ops: F3 RC products + EAS env keys (unblocks production builds), F2 ASC app, F5 host legal, F6 push keys, F8 icon, F7 device white-glove QA, then submit.

### 2. Manhattan: NO-GO to submit, code is GO

**Why.** The only product where every blocker is external to the code. The paywall fails closed by construction (test mode is compile-time impossible in production builds, `launch-environment.ts:96-102`), a pre-install guard hard-fails any production build missing RC keys (`scripts/check-build-env.mjs:33-53`), undeployed event sources return empty rather than fake (SeatGeek absent = silently skipped; NYC Open Data works with zero setup), and cloud is cleanly optional. This is what launch-ready code looks like; it simply has no launch apparatus around it.

**Blockers:** no EAS project (`app.json` has no `extra.eas.projectId`), no RevenueCat products for `mylife_manhattan_unlock`, no privacy policy / ToS / Play data-safety, and the entire native surface (calendar sync, share extension, notifications, purchase flow) has never executed on a physical device. That last item is the real risk gate, not a formality.

**Integrity flag:** `apps/manhattan/eas.json` carries `ascAppId 6763167108`, and `apps/mynews/eas.json` carries the same number. Two apps cannot share an ASC app id; at least one is a copy-paste error. Verify before any submission.

**Resolution path:** eas init (15 min) -> RC products + keys (1-2 hr) -> author + host legal (2-3 hr) -> optional SeatGeek proxy deploy (30 min) -> EAS env injection -> first-ever dev build + on-device QA of the native surface (half day, gating) -> production build -> TestFlight -> submit.

### 3. MyNews: NO-GO, cleanest path to a real beta

**Why.** The code is honest about being dormant and fails closed everywhere ("Never render placeholder data"). There are no code-level CRITs. There is also no product: no Supabase project has been provisioned, so the reader, composer, review desk, and web surface all do nothing for a stranger. Web has no deploy target; the Expo app has no EAS project (though an ASC submit block exists, see the shared-ascAppId flag above).

**Stale-context correction:** the editing-desk migration and all 3 edge functions are committed and tracked on main, not stranded on a worktree.

**Gap that gates UGC:** there is zero moderation, abuse-reporting, takedown, or DMCA handling anywhere, and the planned trust spine has not been authored. A public news platform with reader-submitted edits cannot open submissions without it.

**Resolution path:** provision Supabase + push 3 `nw_` migrations + deploy 3 functions + env + anonymous auth + redirect allowlist (a day of ops) -> deploy mynews-web (Vercel config) -> eas init -> read-mostly beta. Author and build the trust spine before opening edit submission.

### 4. MyLife Hub (mobile): NO-GO

**Why.** Real EAS project, real ASC record (6761207231), goal-based onboarding, zero telemetry as promised. But monetization is architecturally stubbed: `react-native-purchases` is not even a dependency, `createPaymentService` is constructed with no SDK and no key (`_layout.tsx:210-218`), and `packages/entitlements/src/test-mode.ts` hardcodes `_testMode = true`, short-circuiting `isModuleUnlocked` to true for everyone. Today the suite is free with no way to charge; flip the flag and premium modules lock behind a paywall that cannot complete a transaction. Additionally, two user-visible modules (Forums, Market) point at backends that do not exist (see Part 2), a GA module has a stub screen on a linked action, 15 junk `" 2.tsx"` duplicate route files ship into builds as real routes, and an unresolved mobile typecheck error is logged.

**Resolution path:**
1. Module hygiene: deploy Forums + Market backends (schemas exist in-module; the full-function path) with hiding them as the interim honesty stopgap only if a build ships sooner; build the real Health add-med form or route its CTA to the meds module; reframe or wire Presence screen-time; delete the 15 duplicate route files; fix `ModuleHeader.tsx` TS7053.
2. Billing: add react-native-purchases, wire `createPaymentService` with real keys, configure RC products to match `packages/billing-config`, set `_testMode = false`, verify paywall -> purchase -> unlock end-to-end.
3. Store: metadata, screenshots, first production build, TestFlight.

### 5. Meerkat: NO-GO

**Why.** Three independent fatal walls, all confirmed:
1. **Cannot build.** Production Metro export fails on dynamic `require(name)` in `ble-backend.ts:99` and `nearby-backend.ts:66` (errors_log row 13, unresolved). There are also no app icon or splash assets at all (`apps/meerkat/assets` does not exist).
2. **Cannot connect.** `DEFAULT_RELAY_URL` resolves to `''` and no relay, community node, directory node, or TURN is deployed. Two strangers on different networks cannot exchange a single byte. This is deliberate honesty, not an accident, but it means the product does not exist for customers yet.
3. **Cannot pay.** The founder-locked $4.99 one-time and $4.99/mo hosted prices exist only as catalog entries and honest copy. No IAP SDK in either surface; hosted entitlements fail closed to false; no Stripe checkout on web; meerkat-web has no deploy target.

Also missing: privacy policy, ToS, support contact, and server-side data deletion (Play requirement). The engineering underneath (crypto, sync, DMs, communities, public layer) is deep and scrupulously honest, which is exactly why the ruling is clean: everything blocking is founder-ops plus a small set of codeable items.

**Resolution path:** fix the Metro require blocker (~0.5 day, unblocks everything) -> brand assets -> deploy relay/community-node/directory/TURN and flip the relay env (1-2 days) -> deploy meerkat-web -> founder decision on paid vs free launch, then wire IAP + Stripe (3-5 days if paid) -> legal corpus + delete-my-data flow (2-3 days) -> fix the moderation un-hide bug -> 2-device QA matrix + 48h soak -> submit.

### 6. MyLife Hub (web): NO-GO as a hosted product

**Why.** The web hub builds (478 pages) but is not hosted anywhere, has no deploy config, and its data layer is a single better-sqlite3 file at `process.cwd()` shared by all visitors, with a developer's live DB committed to the repo (`apps/web/mylife-hub.db*`). There is no multi-tenancy in the default modes. Stripe is not a dependency; the checkout path throws "Stripe not initialized" the moment test mode stops shielding it. Legal routes and account deletion do exist and are ahead of the other surfaces.

**Decision required before work:** self-host single-user product (documented, honest, ~1-2 weeks to package) versus hosted multi-tenant SaaS (per-user server DB + RLS + auth enforcement + deploy + domain, ~4-8 weeks). Given the founder's full-function mandate the recommendation is the hosted path, but it should be sequenced after the mobile products that are days-to-weeks from revenue, not before.

### 7. BestChef: NO-GO (confirming today's world-launch audit)

**Why.** All five CRITs re-verified live in code today, unchanged since the audit commit:
1. Public builds feed `SAMPLE_GROCERY_PHOTO_JSON` into the recognition pipeline whenever no BYO API key exists (`kitchen-photo.tsx:42,107` -> `kitchen.ts:1492-1494`), so every real user photographing groceries gets fake "Organic Milk" and "Bananas" written into their pantry. This is fabricated data shown to customers, the most serious honesty breach in the portfolio.
2. Empty-ingredient submissions render hardcoded Pad Thai content ungated by the demo policy (`recipe/[id].tsx:382-389`).
3. $0 monetization against fully live per-user AI and video-egress costs; tips/subscriptions fabricate `pi_`/`sub_` ids with `Date.now()` and have zero UI callers, so approved creators structurally cannot be paid.
4. Statutory exposure: no CSAM/NCMEC pipeline on a public UGC photo app, a world-readable pre-moderation storage bucket, no GDPR export.
5. The i18n gate is key-only; ~1,155 byte-identical English values across 21 catalogs pass as "100% parity."

BestChef paradoxically has the most distribution progress (TestFlight iOS build 24) and green gates, which is precisely the trap: the gates do not measure the things that block launch.

**Resolution path:** fix CRIT-1 and CRIT-2 plus the value-identity i18n gate immediately (hours, codeable, do regardless of everything else). Then the audit's four tiers hold: Tier 0 safety/legal (~6-8 eng-weeks, vendor classifier + CSAM/NCMEC + legal corpus + bucket closure + GDPR export + the binding migration deploy before build 25), Tier 1 first-wave product (~6-8 weeks), Tier 2 business model + real payment rail (~3-5 weeks), Tier 3 moat. Vendor contracts are the critical path; first public wave realistically ~3+ months.

### 8. Yearn: NO-GO (hard stop, do not distribute)

**Why.** The cryptography and database provisioning are genuinely done, and that is the trap: what is missing is the entire trust-and-safety spine that is legally non-negotiable for a dating app. No CSAM detection or NCMEC CyberTipline pipeline anywhere (a statutory duty for a US provider hosting user photos, 18 U.S.C. 2258A). Reports write to a table nobody reads: no moderation queue, no admin surface, no SLA, no action model. You cannot report or block the person you are matched with (safety controls exist only pre-match). Chat has no realtime and no polling, so replies never appear until the thread is reopened; it is non-functional as a messenger. The app requests location permission it never uses (App Store rejection risk). It cannot be built (no EAS project) or submitted (no ASC record).

**Resolution path (safety first, in order):** CSAM scan on the upload path + NCMEC reporting -> moderation queue + action model + SLA -> in-chat report/block -> realtime or polling for chat -> real geo or remove the permission and copy -> eas init + ASC + push + legal. Multi-week; do not put this in front of strangers, including external TestFlight, before items 1-3 exist.

---

## Part 2: Hub Module Fleet (41 registry IDs)

The binding launch mechanism is `packages/module-registry/src/release-states.ts`, not code maturity: GA (5) + public beta (13) = 18 user-visible; 23 hidden; `apps/web/lib/modules.ts:56` additionally promotes dining, manhattan, rsvp, sleep, sports on web only.

### Visible modules: rulings

| Module | State | Ruling | Note |
|--------|-------|--------|------|
| budget, habits, meds | GA | **SHIP** | Clean, tested, offline, mature screens |
| recipes | GA | **SHIP with caution** | Local core (`rc_`, offline) is fine; its social/cloud screens ride the BestChef backend, which has unresolved Tier 0 safety gaps. Keep cloud surfaces gated until BestChef Tier 0 lands |
| health | GA | **FIX FIRST** | `apps/mobile/app/(health)/add-med.tsx:8` is literally "Coming soon" and reachable from Vitals (`vitals.tsx:136,146`). A GA module cannot ship a placeholder on a linked core action |
| books, mood, cycle, nutrition, stars, trails, workouts, garden, classes, travel | beta | **SHIP** | Real CRUD, honest states; stars needs tests, trails has an unverified offline-tile dependency |
| presence | beta | **FIX OR REFRAME** | Headline screen-time bridge is a stub (`(presence)/(tabs)/index.tsx:283-285`); the focus-session/streak/XP core is real. Either wire the native bridge or reframe the beta around what works |
| forums | beta | **NOT-READY (CRIT)** | `requiresNetwork: true` against a backend that does not exist; schema never left `modules/forums/src/cloud/schema.sql`; the seed migration self-skips because the tables are absent |
| market | beta | **NOT-READY (CRIT)** | Same pattern: `mk_` schema never deployed, env-gated client, `phase1/phase2` scaffolding still in the route group |
| dining, rsvp, sleep (web override) | web-visible | **SHIP** | Offline sqlite, sleep looks complete through P8-C |
| sports (web override) | web-visible | **VERIFY** | Local journaling fine; live-scores feed unverified. Confirm or hide the Scores tab |
| manhattan (web override) | web-visible | **REVIEW** | Standalone-first product is NO-GO; verify what the web override actually exposes |

### Hidden modules: rulings

- **Correctly and safely gated:** payments/MyPay (verified unreachable on both surfaces, excluded from the web override, dual-control release system intact), fast, journal, notes, flash, words, sleep(mobile), car, closet, mail, pets, subs, create, friends, shop, mynews(hub), manhattan(mobile).
- **voice: NOT-READY and must stay hidden.** There is no audio capture anywhere in the module or app surface (zero expo-av/expo-audio/recording references); "dictation" is a text input in a modal. Surfacing this as voice capture would violate the honesty rule. Build real capture + STT or fold into notes.
- **surf, homes:** metadata drift between `definition.ts` and registry `constants.ts` (storageType/requiresNetwork disagree) and no deployed backends. Reconcile before un-hiding.
- **notes:** core CRUD real; canvas/plugins/databases/clipper are stubs; 8 duplicate route files.

### Fleet-wide hygiene

- **15 committed `" 2.tsx"` duplicate route files** (notes 8, books 5, journal 1, flash 1) become junk routes in shipped builds. Delete them.
- CLAUDE.md's module counts (39 IDs, 30 mobile/27 web) are stale: registry is 41 IDs, and both host apps wire all 41 with visibility governed by release states.

---

## Part 2b: Every Module, Individually (all 41)

One entry per registry module, same adversarial standard as the products. "SHIP" means ready to sell inside the hub the day hub billing works; module readiness cannot exceed the hub's own NO-GO until then.

**GA (visible):**
- **MyBudget: SHIP.** sqlite `bg_`, 33 test files, 55 screens, fully offline, UIUX-parity complete, one trivial flag. Cleanest module in the fleet.
- **MyHabits: SHIP.** sqlite `hb_`, 25 test files, 29 screens, no flags.
- **MyMeds: SHIP.** sqlite `md_`, 23 test files, 39 screens, real add/schedule/log flows.
- **MyHealth: FIX FIRST.** sqlite `hl_`, 11 test files, 32 screens; reachable "Coming soon" at `add-med.tsx:8` from Vitals. Build the form or route to MyMeds.
- **MyRecipes: SHIP with caution.** sqlite `rc_` local core (78 test files in modules/bestchef); cloud/social screens ride the BestChef backend; keep gated until BestChef Tier 0.

**Public beta (visible):**
- **MyBooks: SHIP.** `bk_`, 31 test files, 46 screens; delete 5 dup `" 2.tsx"` routes.
- **MyMood: SHIP.** `mo_`, 11 test files, 31 screens; only free-and-visible module; 3 minor coming-soons.
- **MyCycle: SHIP.** `cy_`, 7 test files, 18 screens; CSV export stub minor.
- **MyNutrition: SHIP.** `nu_`, 20 test files, 22 screens, no flags.
- **MyStars: SHIP.** `st_`, 4 test files, 26 screens; only gap is thin tests.
- **MyTrails: SHIP.** `tr_`, 20 test files, 29 screens; verify offline map-tile dependency.
- **MyWorkouts (hub): SHIP.** `wk_`, 30 test files, offline, independent of the DoWork standalone backend and its START bug.
- **MyGarden: SHIP.** `gd_`, 4 test files, rich screens; add tests.
- **MyClasses: SHIP.** `cs_`, 37 test files, free tier, no flags.
- **MyTravel: SHIP.** `tv_`, 30 test files; CRUD implemented; delete one stale comment.
- **MyPresence: FIX or REFRAME.** `pr_`, 8 test files, 21 screens; screen-time bridge stubbed, focus-session core real.
- **MyForums: NOT-READY (CRIT).** supabase `fr_`; visible with no deployed backend. Deploy or re-hide.
- **MyMarket: NOT-READY (CRIT).** supabase `mk_`; same defect plus `phase1/phase2` scaffolding. Deploy or re-hide.

**Web override (hidden on mobile, visible on web):**
- **MySleep: SHIP.** `sl_`, 64 test files (best-tested in fleet), 33 screens, complete through P8-C.
- **MyDining: SHIP (web).** `dn_`, 16 test files, offline, clean.
- **MyRSVP: SHIP (web).** `rv_`, 11 test files, offline, clean.
- **MySports: VERIFY.** `sp_`, 36 test files; journaling fine, live-scores feed unverified. Confirm or hide the Scores tab.
- **Manhattan (hub): REVIEW.** Standalone is ops-NO-GO; review what the override exposes before any hub web launch.

**Hidden (customers cannot enable these today):**
- **MySurf: GATED.** Cloud module, no deployed backend, definition-vs-registry metadata drift. Reconcile + provision, then promote.
- **MyHomes: GATED.** drizzle/tRPC, same drift + no backend, 5 test files.
- **MyPay (payments): CORRECTLY GATED.** `pay_`, 52 test files; verified sealed on both surfaces behind the dual-control release system; awaits legal/pilot/release-owner approvals.
- **MyVoice: NOT-READY.** `vc_`, 2 test files, 3 screens; no audio capture exists; "dictation" is a text modal. Build real capture + STT or fold into MyNotes.
- **MyNotes: NEEDS-WORK.** `nt_`, 10 test files, 26 screens; core CRUD real, canvas/plugins/databases/clipper stubs, 8 dup route files.
- **MyJournal: SHIP (hidden).** `jn_`, 18 test files, 21 screens, clean; promotion is a product decision.
- **MyFast: SHIP (hidden).** `ft_`, 12 test files, 10 screens; superseded by MyHealth fasting.
- **MyFlash: SHIP (hidden).** `fl_`, 19 test files, 16 screens; import/export stub, wrong `requiresNetwork` metadata.
- **MyWords: SHIP (hidden).** `wd_`, 3 test files, 10 screens; network-dependent, thin tests.
- **MyFriends: GATED.** `fn_`, 17 test files; complete-looking engine set; promote on the social roadmap.
- **MyCar: GATED.** `cr_`, 14 test files; solid; promote after a UIUX pass.
- **MyShop: GATED.** `sh_`, 31 test files; ready-looking; tabs-only nav intentional.
- **MyCreate: GATED.** `ct_`, 9 test files; finish P2-A daily log + streak engine first.
- **MyCloset: GATED.** `cl_`, 4 test files; backfill tests.
- **MyPets: GATED.** `pt_`, 5 test files; backfill tests.
- **MySubs: GATED.** `sb_`, 2 test files; thinnest in fleet; tests + review first.
- **MyMail: GATED.** `ml_`, 6 test files; large scope on thin tests; keep hidden.
- **MyNews (hub): GATED.** `nw_`, 15 test files; defers to the standalone product.
- **Manhattan (mobile): GATED.** Hidden pending standalone launch + UIUX mission-control doc. Correct state.

## Part 3: Systemic Findings

**S1. Revenue is impossible portfolio-wide.** Hardcoded `_testMode = true` in `packages/entitlements` plus no payment SDK in hub mobile, hub web, Meerkat, or BestChef. Only DoWork and Manhattan have real billing code, both blocked on RC products that take about an hour to create. The fastest path to first revenue in the entire portfolio is: create RC products for DoWork, fix the START bug, ship.

**S2. Legal corpus debt everywhere.** Only DoWork has drafted docs (unhosted); hub web has in-app legal routes. Meerkat, Manhattan, BestChef (drafted, unpublished), Yearn, and MyNews all lack hosted privacy policy / ToS, which blocks every store submission. One legal-writing pass could serve all products.

**S3. Trust-and-safety is one shared hole.** BestChef, Yearn, Meerkat's public layer, and MyNews UGC all need the same missing spine: CSAM hash-matching/classification, NCMEC reporting, and a human moderation loop with an action model. Procure once (Thorn/Hive/PhotoDNA class vendor), build one shared intake pipeline, reuse across all four. Vendor lead time is the single longest pole in the portfolio; start procurement now even though BestChef is the only near-term consumer.

**S4. Distribution debt.** Only BestChef has ever produced a store-track build (TestFlight build 24). EAS projects exist for hub mobile, Meerkat, DoWork; missing for Manhattan, Yearn, MyNews. ASC records: hub (6761207231), Manhattan and MyNews claim the same id 6763167108 (at least one wrong), DoWork placeholder, Yearn none. Nothing web-facing (hub web, meerkat-web, mynews-web) is deployed anywhere.

**S5. The honesty discipline mostly held, with one bad exception.** Meerkat, Manhattan, MyNews, and the module fleet consistently fail closed and refuse to fake data. BestChef is the outlier (sample-data short-circuits reaching real users), plus visible stub screens in Health/Presence/Mood and the hollow Voice module. The BestChef pattern (demo fixtures reachable in public builds) should become a repo-wide gate: no `SAMPLE_*` constant may be reachable when the demo policy is off.

**S6. Same-day docs were already stale; code was the only reliable source.** Two findings from yesterday's reports were dead on arrival (DoWork C2 already merged; MyNews editing desk already on main), and CLAUDE.md's registry counts are behind. The audit agents caught these because they re-verified in code. Any launch decision should be re-verified the same way.

---

## Part 4: Recommended Sequence (road to first revenue)

1. **This week, DoWork:** dispatch `START` fix + honesty triage (1-2 days code), F3 RC products + F2 ASC + F5 legal hosting (founder, ~1 day), then device white-glove QA and submit. First sellable product.
2. **In parallel, Manhattan:** eas init, RC products, legal, resolve the shared-ascAppId anomaly, first dev build, device QA of the never-tested native surface. Second sellable product if QA is clean.
3. **In parallel (cheap), MyNews ops:** provision backend, deploy functions and web, read-mostly beta while the trust spine is authored.
4. **Next, Hub mobile:** deploy Forums/Market backends (or gate them if a build ships sooner), fix Health add-med, Presence framing, duplicate routes, typecheck; wire RevenueCat; flip `_testMode` to false only after a real end-to-end purchase passes.
5. **Then Meerkat:** Metro fix, assets, relay deployment, founder pricing decision executed as real IAP + Stripe, legal, delete-my-data, 2-device QA.
6. **Start now regardless:** T&S vendor procurement (serves BestChef, Yearn, Meerkat public, MyNews) and the BestChef deception fixes (CRIT-1/CRIT-2/i18n value gate; hours of work, do not wait for the vendor).
7. **Hold:** Yearn distribution until the safety spine exists; Hub web until the product-shape decision is made.

---

## Appendix A: Per-Module Evaluation (all 41 registry modules)

Legend. State: GA / beta = user-visible today; hidden = cannot be enabled by a customer; "web+" = additionally made visible on web by the override in `apps/web/lib/modules.ts:56`. Tests = test-file count from inspection (not runs). Verdict: SHIP = ready inside the hub as-is; SHIP (hidden) = ready but intentionally gated; FIX = visible with a defect to fix first; GATED = correctly hidden, work remains before promotion; NOT-READY = must not be exposed as-is. All modules are wired on both mobile and web hosts; visibility is governed solely by release state.

| # | Module | Tier | State | Storage | Tests | Verdict | Key gap / resolution |
|---|--------|------|-------|---------|-------|---------|----------------------|
| 1 | books (MyBooks) | premium | beta | sqlite `bk_` | 31 | **SHIP** | 46 screens, mature. Delete 5 committed `" 2.tsx"` dup route files |
| 2 | budget (MyBudget) | premium | **GA** | sqlite `bg_` | 33 | **SHIP** | Cleanest module in the fleet: 55 screens, full offline CRUD, one trivial flag, nothing blocking |
| 3 | car (MyCar) | premium | hidden | sqlite `cr_` | 14 | GATED | Solid local module; promote after a UIUX pass when roadmap calls for it |
| 4 | classes (MyClasses) | free | beta | sqlite `cs_` | 37 | **SHIP** | No flags found |
| 5 | closet (MyCloset) | premium | hidden | sqlite `cl_` | 4 | GATED | Thin tests; backfill before promotion |
| 6 | create (MyCreate) | premium | hidden | sqlite `ct_` | 9 | GATED | Build stopped at P1-C; finish P2-A daily log + streak engine before promotion |
| 7 | cycle (MyCycle) | premium | beta | sqlite `cy_` | 7 | **SHIP** | 18 screens; CSV export stub and a settings gap, both minor |
| 8 | dining (MyDining) | premium | hidden, web+ | sqlite `dn_` | 16 | **SHIP (web)** | Offline, clean. Fine where exposed |
| 9 | fast (MyFast) | free | hidden | sqlite `ft_` | 12 | SHIP (hidden) | Functionally superseded by Health's fasting surface; hiding is the right call |
| 10 | flash (MyFlash) | premium | hidden | sqlite `fl_` | 19 | SHIP (hidden) | Import/export "coming soon"; `requiresNetwork: true` looks wrong for flashcards, fix metadata |
| 11 | forums (MyForums) | free | **beta** | supabase `fr_` | 8 | **NOT-READY (CRIT)** | Visible with NO deployed backend (schema never left `modules/forums/src/cloud/schema.sql`). Deploy migrations + edge fns, or re-hide until then |
| 12 | friends (MyFriends) | free | hidden | sqlite `fn_` | 17 | GATED | Complete-looking engine set; promote when the social roadmap says so |
| 13 | garden (MyGarden) | premium | beta | sqlite `gd_` | 4 | **SHIP** | Rich screen set, offline; test coverage is thin, add tests |
| 14 | habits (MyHabits) | premium | **GA** | sqlite `hb_` | 25 | **SHIP** | 29 screens, no flags |
| 15 | health (MyHealth) | premium | **GA** | sqlite `hl_` | 11 | **FIX FIRST** | `add-med.tsx:8` is a reachable "Coming soon" from Vitals. Build the form or route to the meds module flow |
| 16 | homes (MyHomes) | premium | hidden | drizzle (registry says sqlite: drift) | 5 | GATED | Reconcile definition-vs-registry drift + deploy the drizzle/tRPC backend before un-hiding |
| 17 | journal (MyJournal) | free | hidden | sqlite `jn_` | 18 | SHIP (hidden) | 21 screens, clean; one dup file to delete |
| 18 | mail (MyMail) | premium | hidden | sqlite `ml_` | 6 | GATED | Self-hosted email is a big scope with thin tests; keep hidden |
| 19 | manhattan | premium | hidden, web+ | sqlite (standalone-first) | 258 cases | GATED / REVIEW web+ | Standalone product is ops-NO-GO (see Part 1). Verify what the web override actually exposes before it ships |
| 20 | market (MyMarket) | free | **beta** | supabase `mk_` | 8 | **NOT-READY (CRIT)** | Visible with NO deployed backend; `phase1/phase2` scaffolding still in routes. Deploy or re-hide |
| 21 | meds (MyMeds) | premium | **GA** | sqlite `md_` | 23 | **SHIP** | 39 screens, real add/schedule flows, no flags |
| 22 | mood (MyMood) | free | beta | sqlite `mo_` | 11 | **SHIP** | The only free+visible module. 31 screens; 3 minor "coming soon" spots (export, activity mgmt, focus audio) |
| 23 | mynews (hub module) | premium | hidden | supabase `nw_` | 15 | GATED | Correctly defers to the standalone product (ops-NO-GO, Part 1) |
| 24 | notes (MyNotes) | free | hidden | sqlite `nt_` | 10 | NEEDS-WORK (hidden) | Core CRUD real; canvas/plugins/databases/clipper are stubs; 8 dup route files to delete |
| 25 | nutrition (MyNutrition) | premium | beta | sqlite `nu_` | 20 | **SHIP** | 22 screens, no flags |
| 26 | payments (MyPay) | premium | hidden | supabase `pay_` | 52 | **CORRECTLY-GATED** | Verified unreachable on both surfaces; dual-control release system intact. Stays sealed until legal/pilot/release-owner approvals |
| 27 | pets (MyPets) | premium | hidden | sqlite `pt_` | 5 | GATED | Thin tests; backfill before promotion |
| 28 | presence (MyPresence) | premium | beta | sqlite `pr_` | 8 | **FIX / REFRAME** | Headline screen-time bridge is a stub; focus-session/streak/XP core is real. Wire the native bridge or reframe the beta around what works |
| 29 | recipes (MyRecipes) | premium | **GA** | sqlite `rc_` | 78 | **SHIP w/ caution** | Local core solid; social/cloud screens ride the BestChef backend (unresolved Tier 0 safety gaps). Keep cloud surfaces gated until BestChef Tier 0 lands |
| 30 | rsvp (MyRSVP) | premium | hidden, web+ | sqlite `rv_` | 11 | **SHIP (web)** | Offline, clean |
| 31 | shop (MyShop) | premium | hidden | sqlite `sh_` | 31 | GATED | `navigation.screens: []` (tabs-only) is intentional; ready-looking, promote on roadmap |
| 32 | sleep (MySleep) | premium | hidden, web+ | sqlite `sl_` | 64 | **SHIP** | Best-tested module in the fleet; complete through P8-C, P8-D insights pending |
| 33 | sports (MySports) | premium | hidden, web+ | sqlite `sp_` | 36 | VERIFY (web+) | Local journaling fine; live-scores feed unverified. Confirm the source or hide the Scores tab |
| 34 | stars (MyStars) | premium | beta | sqlite `st_` | 4 | **SHIP** | 26 screens; test coverage thin, add tests |
| 35 | subs (MySubs) | premium | hidden | sqlite `sb_` | 2 | GATED | Thinnest module in the fleet; needs tests + review before promotion |
| 36 | surf (MySurf) | premium | hidden | supabase (registry says sqlite: drift) | 16 | GATED | Reconcile metadata drift + deploy backend before un-hiding |
| 37 | trails (MyTrails) | premium | beta | sqlite `tr_` | 20 | **SHIP** | 29 screens; verify the offline map-tile dependency; waypoint TODO minor |
| 38 | travel (MyTravel) | premium | beta | sqlite `tv_` | 30 | **SHIP** | Delete a stale "later phase" comment (`modules/travel/src/types.ts:24`); CRUD is implemented |
| 39 | voice (MyVoice) | free | hidden | sqlite `vc_` | 2 | **NOT-READY (hidden)** | No audio capture anywhere; "dictation" is a text input in a modal. Build real capture + STT or fold into notes; never surface as-is |
| 40 | words (MyWords) | premium | hidden | sqlite `wd_` | 3 | SHIP (hidden) | `requiresNetwork: true`, thin tests; fine while hidden |
| 41 | workouts (DoWork hub module) | premium | beta | sqlite `wk_` | 30 | **SHIP** | Hub module is offline sqlite and independent of the DoWork standalone's Supabase backend; the standalone's START bug does not affect the hub module surfaces audited |

**Appendix tallies:** 18 visible (5 GA + 13 beta) + 5 more via the web override. Of the visible set: 13 SHIP clean, 1 SHIP with caution (recipes), 2 FIX-first (health, presence), 2 NOT-READY (forums, market), plus VERIFY sports and REVIEW manhattan on the web override. Of the 23 hidden: payments correctly sealed, voice and notes not ready, surf/homes blocked on drift + backends, the rest are ready-or-nearly-ready local modules awaiting deliberate promotion.

---

*Full agent evidence lives in the session log: `docs/sessions/2026-07-05-portfolio-customer-readiness-ruling.md`. Constituent deep audits: BestChef world-launch audit (2026-07-05), DoWork walkthrough (2026-07-05), Meerkat walkthrough + founder-ops runbook, Yearn eval (2026-06-09).*
