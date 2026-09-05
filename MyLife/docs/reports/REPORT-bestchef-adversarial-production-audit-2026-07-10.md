# BestChef Adversarial Production-Readiness Audit

**Date:** 2026-07-10
**Scope:** Full platform. `apps/bestchef` (standalone Expo iOS app), `apps/bestchef-console` (internal moderator console), `modules/bestchef` (`@mylife/bestchef` hub module), `supabase/` (migrations, edge functions, storage, config), hub `recipes` surfaces in `apps/mobile` + `apps/web`.
**Language bar:** all 21 shipped locale catalogs held to launch-full; Bengali/Tamil/Telugu treated as expansion, not defects.
**Method:** 12 dimension finders over live code + 55-agent adversarial workflow. Every critical/high finding independently re-verified by a second opus refuter and a codex (gpt-5.5) refuter; mediums re-verified by opus; completeness critic swept for gaps. 0 findings refuted, 18 confirmed, 7 partial, 1 disputed (framing wrong, underlying gap real).

---

## Verdict: NO-GO for public GA. NO-GO for the 21-language launch.

This confirms and refreshes the 2026-07-05 world-launch verdict. There have been **zero BestChef code commits since 2026-07-05** (verified: only one docs-only commit `d3caa1fe`), so every launch-blocking finding from that audit remains live in code today, and several plan-33 "DONE" claims that imply otherwise are false.

The failure is **not engineering plumbing** and not test health. The substrate is genuinely strong (see "What is actually solid"). The blockers cluster in four areas a global consumer launch cannot ship without: **user-facing content honesty** (the app fabricates AI/recipe results), **trust-and-safety enforcement** (unmoderated media is world-readable at upload; auto-approving stub classifiers), **legal compliance** (unpublished legal corpus, mislabeled data export, missing child-safety reporting duty), and **money honesty** (fabricated payment IDs, no real rails).

| Readiness axis | Score | Note |
|---|---|---|
| Engineering substrate (RLS, rate limits, offline, gates, tests) | 8.5 / 10 | Real and production-grade |
| Content honesty (no fabricated output) | 2 / 10 | 4 ungated fabrication sites in public builds |
| Trust & safety enforcement | 3 / 10 | Reactive tools real; proactive screening absent |
| Legal / compliance | 3 / 10 | Corpus unpublished, export mislabeled, child-safety duty unmet |
| Localization (21-locale launch-full) | 6 / 10 | Presence 100%, value ~89-94%; gate blind to it |
| Money honesty | 2 / 10 | Fabricated IDs, no processor, no payout UI |
| **Overall GA (EN/US iOS)** | **4 / 10** | |
| **Overall 21-language GA** | **3 / 10** | |

---

## What is actually solid (verified, do not re-litigate)

The adversarial pass confirmed a large amount of real, well-built infrastructure. Give it credit and protect it:

- **RLS is comprehensive.** All 60 `bc_` tables have RLS enabled. Ledger/control tables are correctly definer-only (RLS on, zero policies = fail-closed). Direct writes to `bc_votes`/`bc_vote_proofs` are blocked and routed through `SECURITY DEFINER` RPCs. Privilege-escalation RPCs (`bc_apply_moderation_decision`, `bc_resolve_appeal`) are `bc_is_admin()`-gated and granted only to `service_role`.
- **Durable server-side rate limits are real.** `bc_consume_action_quota` + BEFORE INSERT triggers enforce votes/comments/follows/reports/likes/appeals server-side (not client-side), with kill switch.
- **JWT split is correct.** `config.toml` and `deploy-functions.sh` agree: 3 worker functions run `verify_jwt=false` and enforce a server-only secret; user-facing functions rely on gateway verification.
- **Console security is sound.** Service-role key is server-only; fail-closed email allowlist enforced in middleware AND every server action.
- **Offline data layer is strong.** v1..v33 migration chain is contiguous and transactional; 4 of 5 op-queue sweepers correctly mounted (proofs, bookmarks, media, submissions); app-death media requeue works; dual-store reconciliation favors cloud.
- **Video playback works end-to-end today.** Client durable job → private bucket upload → console approve flips `bc_media_assets` to approved/public/ready → 365-day signed URL → feed renders. Any claim that video playback is broken is false.
- **Prior breakages are genuinely fixed:** `slugify()` handles non-Latin scripts; paste-import runs a real JSON-LD parser (not dead code); F-008 video comments and F-010 saved submissions are closed for real; account-deletion worker deletes storage + auth user on a real cron.
- **i18n engine is real:** CLDR plural variants (`#zero/#two/#few/#many`) present and grammatically correct in ar/he/pl; Hermes Intl polyfills wired for all 21 locales; backend notifications rewritten to `kind`+`params` localized client-side; UGC language tagging live; safety/compliance strings 100% translated in all 20 non-EN locales.
- **Gates are genuinely wired and green.** App typecheck PASS; 328 app tests PASS; 1,423 module tests PASS; i18n-parity, raw-strings, rtl-icons, compliance-keys gates all clean and wired into `check:parity` (CI + task-completion hook). Nothing is fabricated-green.

---

## Launch-blocking findings (Critical)

Deduplicated across dimensions. Status is the adversarial verdict (CONFIRMED / PARTIAL = core real, detail refined).

### C1. Unmoderated submission images are world-readable at upload — CONFIRMED
`bestchef-submission-images` is created `public=true` with an anon SELECT policy over the whole bucket, so every uploaded object is fetchable by URL the instant it lands, before any moderation. The `bc_media_assets.moderation_status='pending'` DB gate does not gate the storage object at all. This is the single most dangerous interaction on the platform because it compounds with C3/C4/C5 (no automated screening).
- Evidence: `supabase/migrations/20260429000001_bestchef_cloud_feature_backfill.sql:10`; `supabase/migrations/20260428000016_storage_policies.sql:64-67`.
- Fix: make the bucket `public=false`; serve approved images via short-lived signed URLs only after `moderation_status='approved'`, mirroring the vote-proofs/videos pattern. Do not enable `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH` until this lands.

### C2. Recipe submissions publish unmoderated by default — CONFIRMED
`bc_submissions.moderation_status` defaults to `'approved'`; the INSERT policy checks only ownership with no with-check on status, and the guard trigger is UPDATE-only. The app inserts directly and omits the field, so every submission (recipe text, photo, geolocation) is instantly public.
- Evidence: `supabase/migrations/20260424000005_add_bestchef_core_hub.sql:384, :986, :984, :1781`.
- Fix: default to `'pending'`; add a with-check forcing `pending` for non-admins (or a BEFORE INSERT stamp); route publication through the moderation queue.

### C3. Vote-proof moderation auto-approves via stub classifiers, and is never scheduled — PARTIAL (core confirmed)
The production `moderate_vote_proof` entrypoint wires stub providers that always return "safe"/"food", so `buildDecisionPlan` always approves. Nothing invokes the worker on a schedule. Verifier note (makes it worse): a stub approval both activates the vote and publishes the media — there is no vote-weight fail-safe.
- Evidence: `supabase/functions/moderate_vote_proof/index.ts:710, :469-506, :128-129`; `supabase/migrations/20260610000001_bestchef_scheduled_jobs.sql:90-99`.
- Fix: wire real providers in the production entrypoint (never the stub), fail-closed on provider outage, and schedule/queue the worker. Gate launch on a non-stub provider being configured.

### C4. Submission/comment/post media is enqueued for moderation but nothing screens it — PARTIAL (core confirmed)
`bc_enqueue_media_for_moderation` inserts `kind='media_asset'` rows, but no worker drains them. The console `/media` page handles only `owner_kind='submission'` + `media_kind='video'`. Submission/comment/post images are never automatically screened. Refinement: a manual escape hatch exists via the Reports workflow for flagged content, so images are not literally un-actionable — just unscreened.
- Evidence: `supabase/migrations/20260529000004_bestchef_media_moderation_enqueue.sql:22-38`; `apps/bestchef-console/app/media/actions.ts:59, :108`.
- Fix: build/deploy a worker that drains `kind='media_asset'` for all owner kinds and both media kinds; extend the console to review image assets. Keep images private until screened.

### C5. No child-safety reporting duty implementation — PARTIAL (core confirmed)
There is no hash-match child-safety provider and no NCMEC/CyberTipline reporting workflow (18 U.S.C. §2258A) anywhere in the code. The only occurrence of the requirement is a comment describing an unbuilt worker.
- Evidence: repo-wide grep resolves to a single comment at `supabase/migrations/20260529000004_bestchef_media_moderation_enqueue.sql:9`; `legal/data-deletion.md` references child-safety retention with no implementing code.
- Fix: contract a hash-match provider (Thorn Safer / PhotoDNA / Cloudflare CSAM), run it before any public exposure of user images, and wire the mandatory NCMEC reporting + retention path. This is a hard legal gate for any US wave and should block public GA globally.

### C6. Kitchen grocery-photo AI fabricates results in public builds — CONFIRMED
`kitchen-photo.tsx` seeds the candidate field with `SAMPLE_GROCERY_PHOTO_JSON` and only clears it when a BYO provider key exists (never, in public builds). `createKitchenFoodPhotoReview` short-circuits on the raw candidate JSON before the broker. A public user photographing groceries gets hardcoded "Organic Milk"/"Bananas" and can confirm it into real pantry/nutrition data. Ungated by `shouldShowDemoContent`.
- Evidence: `apps/bestchef/app/(root)/kitchen-photo.tsx:42, :107, :169`; `data/kitchen.ts:1492-1499`.
- Fix: seed to `''` in public builds; route every public photo through the broker; gate the sample behind `__DEV__` + `EXPO_PUBLIC_USE_DEMO_FIXTURES`.

### C7. Kitchen receipt import fabricates OCR text in public builds — CONFIRMED
Same pattern: `kitchen-receipt.tsx` opens with `SAMPLE_RECEIPT_OCR_TEXT` and the default `manual_text` path parses it, letting a user confirm fabricated line items into pantry/nutrition. Ungated.
- Evidence: `apps/bestchef/app/(root)/kitchen-receipt.tsx:54, :122, :130-135`; `data/kitchen.ts:252-257`.
- Fix: seed to `''` in public builds; keep the sample in dev fixtures only.

### C8. Expiration-photo OCR fabricates a date in public builds — PARTIAL (confirmed; not silent)
`expiration-photo.tsx` opens with `SAMPLE_EXPIRATION_OCR_TEXT` ('BEST BY 05/03/2026'), and the default path parses a fabricated date. Refinement: the confirm action is disabled until the user manually selects a date and assigns an item, so it is not silent auto-application — but the fabricated data is still presented.
- Evidence: `apps/bestchef/app/(root)/expiration-photo.tsx:64, :118`; `data/kitchen.ts:285`.
- Fix: seed to `''` in public builds (gate on demo policy).

### C9. Recipe detail fabricates ingredients/steps for real submissions — CONFIRMED
`recipe/[id].tsx` substitutes hardcoded Pad Thai `SAMPLE_INGREDIENTS`/`SAMPLE_STEPS` whenever a real submission has empty arrays. Unlike the adjacent `DEMO_DISHES` lookup two lines above (which IS gated by `shouldShowDemoContent()`), this substitution has no gate and feeds fabricated content into nutrition/grocery flows.
- Evidence: `apps/bestchef/app/(root)/recipe/[id].tsx:378` (gated) vs `:384, :388` (ungated).
- Fix: gate both fallbacks on `shouldShowDemoContent()`, or render an honest empty/partial state.

### C10. Monetization is fabricated — CONFIRMED
No IAP/RevenueCat/StoreKit dependency exists anywhere in `apps/bestchef`. The tips and subscriptions engines mint fake Stripe IDs (`pi_${Date.now()}`, `sub_${Date.now()}`) with no processor call. The only creator UI (`creator-program.tsx`) never imports the tip/subscribe engines, so an approved creator can never actually be paid. Violates the transport-honesty and no-deferral mandates.
- Evidence: `modules/bestchef/src/cloud/tips.ts:84`; `modules/bestchef/src/cloud/subscriptions.ts:166`; `apps/bestchef/app/(root)/creator-program.tsx:15-20`.
- Fix: either wire real StoreKit/RevenueCat + Stripe + payout UI, or make the founder decision explicit and remove fabricated success paths. Do not ship fake payment IDs.

### C11. Anonymous sybil voting / leaderboard manipulation — CRITIC (strong, unverified)
Anonymous sign-ins are enabled and no vote/submission/comment path rejects anonymous accounts, opening an unbounded sybil vector: one device can mint anonymous accounts to inflate votes and manipulate leaderboards beyond what proof-hash dedup catches.
- Evidence: `supabase/migrations/20260703000002_bestchef_integrity_floor.sql`; anonymous-first auth in `BestChefCloudProvider.tsx:97`.
- Fix: require proof-of-humanity or a verified (non-anonymous) account before a vote counts toward rankings; weight or quarantine anonymous votes; add device/account-age heuristics to the integrity floor.

### C12. `votes_received` challenges query a nonexistent column — PARTIAL (confirmed; scoped)
`countMetricForUser` selects `bc_submissions.vote_count`, which does not exist (schema has `vote_score`/`upvote_count`/`downvote_count`). PostgREST returns 400, the error is swallowed, and progress is frozen at 0. Refinement: only `bc_challenges` rows with `metric='votes_received'` are affected, and the repo seeds none, so impact is limited to manually-seeded challenges of that type.
- Evidence: `modules/bestchef/src/cloud/challenges.ts:518-525`; `supabase/migrations/20260424000005_add_bestchef_core_hub.sql:383`.
- Fix: select `vote_score` (or sum `upvote_count`); surface query errors; add a regression test.

---

## High-severity findings

Findings marked *(reported)* were surfaced by a finder but fell beyond the adversarial re-verification cap; treat as high-confidence-pending-confirmation. All cite file:line.

| # | Finding | File | Status |
|---|---------|------|--------|
| H1 | PostgREST filter injection in `searchChefs` via client-composed `.or(ilike)` with raw user input (the exact pattern already hardened for dish search) | `modules/bestchef/src/cloud/chef-profile.ts` | reported |
| H2 | Hub mobile `recipes` surface is a scoped offline adapter, not parity-complete; several social routes exist but the module declares `requiresNetwork:false` and the pairing is undocumented as partial | `modules/bestchef/src/definition.ts` | partial (framing corrected) |
| H3 | GDPR Art. 20 export is mislabeled: "Export my data" returns only local SQLite, and the "full account export" link is dead | `apps/bestchef/app/(root)/data/data-export.ts` | reported |
| H4 | No statement-of-reasons delivered to users on moderation decisions, though guidelines promise it (DSA Art. 17) | `supabase/migrations/20260427000011_bestchef_moderation_ops.sql` | reported |
| H5 | Legal corpus unpublished, English-only, and Terms/Privacy still carry unfilled `[OPERATOR LEGAL NAME]` / `[GOVERNING LAW]` placeholders; no evidence the `bestchef.app` URLs the app links to are hosted | `apps/bestchef/legal/terms.md`, `constants/legal.ts` | reported + critic |
| H6 | 365-day signed playback URLs have no re-sign/rotation job — every approved video breaks in one silent expiry cohort ~1 year after launch | `apps/bestchef-console/lib/media-promotion.ts` | reported |
| H7 | No CDN, transcoding, or video compression — raw phone MP4s (up to 150 MiB) stream from Supabase origin to every viewer; plan 33 Phase 4.1 acceptance unmet | `apps/bestchef/app/(root)/data/media-upload-worker.ts` | reported |
| H8 | i18n parity gate compares key presence only, never values — the value-completeness hole is open and passes at fake "100%" | `apps/bestchef/scripts/check-i18n-parity.mjs` | reported |
| H9 | A coherent 52-string batch of real UI strings ships English in all 20 non-English catalogs (home greeting, whole ingredient editor, edit-profile validation, core social labels, submit-status) | `apps/bestchef/app/(root)/i18n/catalogs/*.ts` | reported |
| H10 | Creator Dashboard (reachable to approved creators) renders a fabricated monthly-revenue chart and fake Revenue stat with no payment backend | `apps/mobile/app/(recipes)/creator-dashboard.tsx` | reported |
| H11 | T&S report sweeper is mounted nowhere; offline reports never auto-retry (violates the B-003 durability guarantee) | `apps/bestchef/app/(root)/(tabs)/_layout.tsx` | reported |
| H12 | Account-deletion local wipe omits three live user-data tables (`rc_media_upload_jobs`, `rc_saved_submissions_cache`, `rc_pantry_staples`); user data (incl. uploaded-media URLs) survives "Delete Account" | `apps/bestchef/app/(root)/data/account.ts` | reported |
| H13 | Zero push notification implementation despite in-app notification UI (no dependency, no `aps-environment`, no token registration) | `apps/bestchef/app.json` | reported |
| H14 | Zero observability/crash reporting (no Sentry/Bugsnag/Crashlytics in app or edge) and zero automated alerting on job health | `apps/bestchef-console/app/page.tsx` | reported |
| H15 | iOS audio session never configured, so all feed/detail video audio is silenced by the hardware mute switch | `apps/bestchef/app/(root)/feed.tsx` | critic |
| H16 | Ticket ledger falsely claims F-045/046/047 (DEMO_* fixture removal) closed 2026-06-09; `discover.tsx`, `feed.tsx`, `recipe/[id].tsx` still use fixtures | `apps/bestchef/Tickets/README.md` | reported |
| H17 | Module registry metadata (`MODULE_METADATA`) still shows the module as pre-rebrand "MyRecipes" on both mobile and web Discover screens | `packages/module-registry/src/constants.ts` | reported |
| H18 | Hosted submission-image/avatar buckets have no server-enforced size or MIME limits (migration omits them; `config.toml` drift local vs prod) | `supabase/migrations/20260429000001_bestchef_cloud_feature_backfill.sql` | reported |

---

## Medium-severity findings

| # | Finding | File | Status |
|---|---------|------|--------|
| M1 | Age gate is device-region self-attestation with a trivial relaunch bypass and spoofable region; no DOB, no server-side record | `apps/bestchef/app/(root)/i18n/LanguageOnboardingGate.tsx` | CONFIRMED |
| M2 | Video finalize never sends duration/width/height, so `bc_media_assets.duration_ms` stays null and feed cards show no duration | `modules/bestchef/src/cloud/submission-photo.ts` | CONFIRMED |
| M3 | Language picker presents all 20 locales as COMPLETE (no partial flag) despite the 52-string English gap | `apps/bestchef/app/(root)/i18n/LanguageOnboardingGate.tsx` | PARTIAL |
| M4 | Badge names/descriptions are English-only in the DB and render un-localized for all 20 non-English locales | `supabase/migrations/20260424000005_add_bestchef_core_hub.sql` | CONFIRMED |
| M5 | Fake in-memory Tip and Subscription payment screens exist in the recipes hub (registered; success screens claim "95% goes to the chef") | `apps/mobile/app/(recipes)/tip.tsx` | CONFIRMED |
| M6 | RTL restart path uses the dev-only `DevSettings.reload` API, so Arabic/Hebrew RTL cannot apply in a production release build | `apps/bestchef/app/(root)/i18n/I18nProvider.tsx` | critic |
| M7 | "Max 200 MB" video copy contradicts the real 150 MiB server cap; a 151-200 MB video passes the picker then hard-fails at the byte gate | `apps/bestchef/app/(root)/utils/media.ts` | reported |
| M8 | Moderator console job-health checklist has a blind spot for the media-purge worker (aggregate badge correct; itemized rows missing) | `apps/bestchef-console/lib/mappers.ts` | PARTIAL |
| M9 | `bc_job_config` seeding is manual-SQL-only with no seeding script, verification, or CI gate; unseeded rows silently no-op the deletion + purge workers | `supabase/migrations/20260704000002_bestchef_media_purge_job.sql` | CONFIRMED |
| M10 | Six V29-V33 local-only tables lack `device_local` syncPolicy rules; the outbound change-tracker fails OPEN to `personal_replica` (latent while mesh off in GA; CLAUDE.md policy violation) | `modules/bestchef/src/definition.ts` | CONFIRMED |
| M11 | Cook mode is unreachable from saved (private) recipes; only community submissions get step-through cook mode | `apps/bestchef/app/(root)/cook-mode/[id].tsx` | CONFIRMED |
| M12 | Barcode "scan" is manual keypad entry only (no camera); labeled "Scan barcode" (no-deferral / honesty gap) | `apps/bestchef/app/(root)/kitchen-barcode.tsx` | CONFIRMED |
| M13 | No fastlane/EAS store-metadata pipeline for any of the 21 shipped locales | `apps/bestchef/eas.json` | reported |
| M14 | No App Tracking Transparency handling verified against actual SDK behavior; privacy manifest asserts no tracking, unaudited | `apps/bestchef/app.json` | critic |
| M15 | Web hub `recipes` cloud wiring is partial (read/vote only); missing chef-profile edit, follow, cloud comments, and moderation-facing UGC flows the standalone ships | `apps/web/app/recipes/cloud-actions.ts` | reported |

---

## Low-severity findings

- **L1** Worker-secret comparison is non-constant-time (timing side channel) in the three worker functions. `supabase/functions/moderate_vote_proof/index.ts`.
- **L2** Bengali/Tamil/Telugu (bn/ta/te) catalogs absent — Indic expansion item, not a defect.
- **L3** Repeated app-death during upload burns the retry budget and permanently fails an otherwise-valid job. `modules/bestchef/src/social/media-upload-queue.ts`.
- **L4** Only Latin (Plus Jakarta Sans) fonts bundled; ja/zh/ko/hi/th/ar/he fall back to system fonts (iOS-only, no tofu; quality only). `apps/bestchef/app/_layout.tsx`.
- **L5** No IAP/StoreKit/RevenueCat/Stripe SDK present (consistent with "free at launch"; zero real rails exist).
- **L6** Alias-bridge race-loss path deletes its own draft before confirming the winner exists. `modules/bestchef/src/cloud/submission-alias.ts`.
- **L7** Zero analytics posture (no first-party or third-party product analytics).
- **L8** Migration filenames collide across modules at identical timestamps (relies on filename alpha-sort for tie-break).
- **L9** EN catalog is 994 keys, not the "995 keys x21" asserted in plan 33.
- **L10** `check:parity` module-suite test filter pulls in ~40 unrelated test files (mynews/dowork/`_shared`), inflating the documented "module suite" count.

---

## Localization: 21-locale launch-full assessment

Presence parity is genuinely 100% (all 21 non-EN catalogs at 994/994 keys, 0 missing, 0 empty). The gap is **value completeness**: every non-EN locale carries the same 52-string untranslated English batch plus legitimate loanwords. The parity gate is presence-only and cannot see this, so it passes at a misleading "100%."

| Locale | Keys | Identical-to-EN | Translated % | Verdict |
|---|---|---|---|---|
| es | 994 | 78 | 92% | partial |
| fr | 994 | 107 | 89% | partial |
| de | 994 | 100 | 90% | partial |
| it | 994 | 84 | 92% | partial |
| pt-BR | 994 | 76 | 92% | partial |
| pt-PT | 994 | 76 | 92% | partial |
| nl | 994 | 102 | 90% | partial |
| sv | 994 | 90 | 91% | partial |
| pl | 994 | 77 | 92% | partial (CLDR few/many OK) |
| tr | 994 | 69 | 93% | partial |
| id | 994 | 90 | 91% | partial |
| vi | 994 | 69 | 93% | partial |
| hi (Hindi) | 994 | 57 | 94% | partial |
| th | 994 | 55 | 94% | partial |
| ja (Japanese) | 994 | 57 | 94% | partial |
| ko (Korean) | 994 | 56 | 94% | partial |
| zh-Hans (Chinese) | 994 | 57 | 94% | partial |
| zh-Hant (Chinese) | 994 | 57 | 94% | partial |
| ar | 994 | 57 | 94% | partial (RTL + CLDR dual OK) |
| he | 994 | 57 | 94% | partial (RTL + CLDR dual OK) |

**Your 7 target languages** — Chinese (zh-Hans + zh-Hant), English, Spanish, French, Japanese, Hindi ("Indian"), Korean — are all present and all at parity-key 100% / value ~89-94%. None is launch-full yet. The placeholder-token check found **zero** real `{var}` mismatches (the 7 ar/he `#two` hits are correct dual grammar, not bugs).

**Indic expansion:** only Hindi ships. Bengali (bn), Tamil (ta), Telugu (te) are absent — expansion items for the Indian market, planned in the remediation doc, not counted as launch defects.

**Additional localization gaps beyond the 52-string batch:** badge names/descriptions are raw English DB rows (M4); the picker mislabels partial locales as complete (M3); RTL can't apply in release builds (M6); non-Latin fonts fall back to system (L4).

---

## Git history review

- **Cadence:** first BestChef commit `61fb9851` (2026-04-22). 115 main commits touch true BestChef paths: 65 in April (dense P0-P16 burst, mostly 2026-04-27), then 6 in May, 8 in June, 36 in July (the plan-33 launch-hardening sprint, concentrated 2026-07-03/04). Last code commit `a329a393` (2026-07-04). Zero code commits since; two doc-only commits after.
- **Gaps:** the docs' "23-day idle" figure does not match measured data. Actual path-filtered gaps are 30 days (2026-05-11 → 2026-06-10) and 14 days (2026-06-19 → 2026-07-03). Burst-and-starve is the real meta-risk.
- **Regression pattern:** the `HERO_GRADIENT` invalid-cast native crash was introduced (2026-04-27), fixed narrowly (2026-05-05), reintroduced in 3 places, then re-fixed with a file-scanning test (2026-07-04). HEAD is clean.
- **Contradicted claims:** `8d6e898c` "replace DEMO data with live content" admits in its own body that discover/feed/catalog are unmigrated; `Tickets/README.md` later claims F-045/046/047 closed — false, fixtures still used (H16).
- **Branch/working-tree state:** clean for all BestChef surfaces. No BestChef work is stranded on any feature branch or worktree; all traces back through `main`. The 7 deploy-gate migrations (`20260703000002..6` + `20260704000001..2`) are all present and correctly sequenced. "Build 25" is external App Store Connect state, not verifiable from the repo.

---

## Deploy gates that still stand (from plan 33, verified)

These are real, still-open, and mostly founder/vendor-owned:

- **Migrations before build 25:** `20260703000002..000006` + `20260704000001..000002` must be applied to staging AND prod before build 25 ships; unmigrated environments reject every publish/comment (new clients write the `language` column unconditionally).
- **F1** Dashboard-verify prod project + push `20260529000005` + `20260610000001` to prod.
- **F2** Host the legal pages at the real URLs (blocked by H5).
- **F3** Contract classifier + child-safety vendors and register the reporting path (blocks C3/C4/C5).
- **F4** Supabase Pro (CDN/transforms) + video streaming provider (blocks H6/H7).
- **F5** Professional translation review of the launch catalogs (blocks the 52-string batch + value gate).
- **F6** App Store Connect: 21-locale listings, age ratings, privacy labels (blocks M13).
- **F7** Approve per-market editorial seed personas + provenance.

---

## Recommendation

Do not enable `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH` or ship a public wave until the Critical tier is closed. The remediation plan is `docs/plans/queue/45-bestchef-production-readiness-remediation.md`, sequenced Tier 0 (safety/legal/honesty gates) → Tier 1 (launch quality incl. the 21-locale value gate) → Tier 2 (scale infra) → Tier 3 (money decision) → Tier 4 (Indic expansion). The engineering substrate is strong enough that the Tier 0 client-side fabrication fixes (C6-C9) and the storage/moderation defaults (C1-C2) are days of work, not weeks; the true long-pole is vendor procurement (F3 child-safety + classifiers, F5 translation) which should start in week 1.

*Audit method: 55-agent adversarial workflow, 4.2M tokens. Every Critical/High independently refuted by a second opus verifier and a codex (gpt-5.5) verifier. 0 of 26 re-verified findings were refuted.*
