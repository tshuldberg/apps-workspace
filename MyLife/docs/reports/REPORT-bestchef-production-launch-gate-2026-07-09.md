# BestChef Production Launch Gate

**Decision date:** 2026-07-09

**Decision:** **NO-GO. Production launch authorization denied.**

**Reviewed commit:** `d3caa1fe3b51d0eb8897af28d27585883ab87952`

**Release artifact compared:** EAS build `0358ead1-bb5d-42bc-a272-5212951810f1`, commit `8a65bc8cbdbd3d15cd3468e5193b9657c0131118`, created 2026-05-12
**Surfaces:** `apps/bestchef`, `apps/bestchef-console`, `modules/bestchef`, BestChef Supabase migrations and Edge Functions, EAS configuration, legal files, release automation, and current hosted project state

## Executive decision

BestChef must not be submitted for production or opened to public users in its current state.

The production Supabase project configured into the release environment is inactive and its hostname does not resolve. The newest store build is from May 12 and predates 58 scoped commits touching 314 files. The deployed Edge Function fleet is from April 29, omits the media-purge worker, and has worker JWT settings that contradict the current source configuration.

Even after the production plane is restored, the reviewed code cannot pass launch. Public CookProof moderation uses hardcoded stub classifiers whose default scores approve arbitrary images. General media moderation and a CSAM escalation path do not exist. Submission images are anonymously readable before moderation. Account deletion wipes local recovery data and reports success after server-side deletion errors. Grocery-photo and recipe-detail paths fabricate data.

This is not a close call. A green unit test suite does not offset dead production infrastructure, false user-facing results, missing public-UGC safety controls, and invalid legal surfaces.

## Evidence rule

Existing plans, tickets, prior audits, legal copy, and status labels were treated as untrusted claims. A claim appears as verified here only when supported by current code, current git history, a local executable check, or a read-only query against the configured service.

The July 5 launch audit was used only as a candidate-finding list. `git diff fbef9997..d3caa1fe` shows no BestChef runtime change after that report. Every finding retained below was still re-read in current source. Claims that did not survive code verification were discarded or narrowed.

## Launch scorecard

| Gate | Status | Evidence |
|---|---:|---|
| Production backend reachable | **FAIL** | Supabase project `zjxabnazbdocrqpyixgo` reports `INACTIVE`; project DNS does not resolve; migration listing timed out. |
| Current production binary | **FAIL** | Latest store build is May 12 at `8a65bc8c`; reviewed code is `d3caa1fe`, 58 scoped commits and 314 changed files later. |
| Current backend deployment | **FAIL** | Seven v3 functions were last updated 2026-04-29; `bestchef-media-purge` is missing; two worker functions have `verify_jwt=true`. |
| Real content safety | **FAIL** | Live Deno handler injects stub NSFW, food, and face providers; default values produce approval. No general media worker or CSAM implementation exists. |
| Private pre-moderation media | **FAIL** | Migrated bucket is public, anonymous SELECT covers every object, and the app returns `getPublicUrl()` immediately after finalize. |
| Truthful user data | **FAIL** | Grocery-photo recognition and empty recipe details can display unrelated sample data. |
| Deletion and export rights | **FAIL** | Deletion fails open and destroys local recovery; export is device-only and points users to the deletion page for a full export. |
| Legal and support surfaces | **FAIL** | `bestchef.app` has no resolving DNS; legal source contains unresolved operator, date, hosting, and venue placeholders. |
| Core workflows complete | **FAIL** | Core slider actions route to `/soon`; camera barcode capture, grocery delivery, GS1, payments, push, and production video delivery are unfinished or stubbed. |
| Release quality gates | **FAIL** | Edge Function TypeScript project has four errors; live production smoke is skipped and cannot run against the inactive project. |

## Critical launch blockers

### C1. The configured production backend is inactive and unreachable

**Confidence:** 10/10, externally verified.

- EAS production environment points at Supabase ref `zjxabnazbdocrqpyixgo` with `EXPO_PUBLIC_BESTCHEF_CLOUD_ENV=production` and `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1`.
- `supabase projects list --output json` reports that ref as `INACTIVE`, region `us-west-2`, project name `tshuldberg's Project`.
- The project API hostname does not resolve. `supabase migration list --linked` cannot connect and returns a database timeout.
- The only live production smoke suite is guarded by `describe.skipIf(!shouldRun)` in `modules/bestchef/src/cloud/__tests__/testflight-smoke.live.test.ts:78`.

**User impact:** authentication, social data, media, moderation, account deletion, provider brokering, and recovery cannot work for public users.

**Required closure:** reactivate or replace the production project, prove DNS and database health, apply every migration, and run the full live smoke suite against the exact release environment.

### C2. No production binary contains the reviewed code

**Confidence:** 10/10, git and EAS verified.

- Latest store build: build 24, EAS ID `0358ead1-bb5d-42bc-a272-5212951810f1`, commit `8a65bc8c`, created 2026-05-12.
- Reviewed source: `d3caa1fe`, with 58 scoped commits and `314 files changed, 31,585 insertions, 13,867 deletions` after the build commit.
- The public iTunes lookup for App Store Connect ID `6763167108` returns `resultCount: 0`, which confirms there is no public listing to validate.

**User impact:** none of the security, data, localization, or workflow changes after May 12 can be attributed to the available store artifact.

**Required closure:** build a new production IPA from the reviewed release SHA, install that exact artifact on clean devices, and bind every launch test result to its EAS build ID and git SHA.

### C3. The deployed Edge Function fleet is stale, incomplete, and misconfigured

**Confidence:** 10/10, source and hosted metadata verified.

- Hosted functions are seven version-3 deployments last updated 2026-04-29.
- `bestchef-media-purge` exists in source and is required by `supabase/config.toml:431`, but it is absent remotely.
- Hosted `moderate_vote_proof` and `bestchef-delete-account` both have `verify_jwt=true`.
- Current source explicitly requires `verify_jwt=false` for those worker-secret functions because cron and server tooling do not send a user JWT, `supabase/config.toml:418-432`.

**User impact:** worker calls can be rejected at the gateway, account deletions and moderation can remain queued, and current backend fixes are not deployed.

**Required closure:** deploy all eight current functions from the release SHA, assert content hashes and JWT flags after deployment, then execute each user and worker path end to end.

### C4. CookProof moderation is a hardcoded approval stub

**Confidence:** 10/10, verified by code tracing and tests.

- `createStubVoteProofModerationProviders()` reports NSFW score `0.02`, food score `0.91`, and `available: true`, `supabase/functions/moderate_vote_proof/index.ts:454-505`.
- Approval thresholds are NSFW `< 0.72` and food `>= 0.55`, `index.ts:128-129,229-252`.
- The live Deno entry point always injects those stubs, `index.ts:694-711`.
- Approved decisions activate the vote and mark media public, `supabase/migrations/20260427000011_bestchef_moderation_ops.sql:293-312`.

**Attack path:** an authenticated user uploads any image as vote proof; the worker assigns the fixed safe scores; the decision plan approves it without examining the bytes; the vote becomes active and the media is marked public.

**Required closure:** integrate real classifiers behind the existing interface, fail closed to human review on outage or uncertainty, test adversarial images, and prohibit deployment when any provider identifies itself as a stub.

### C5. General media moderation and CSAM handling do not exist

**Confidence:** 10/10, repository-wide code search and scheduling review.

- `20260529000004_bestchef_media_moderation_enqueue.sql:8-10` says a future worker must drain `media_asset` rows and run NSFW, food, and CSAM checks. No such implementation exists.
- No cron schedules `moderate_vote_proof`; scheduled jobs cover rankings, deletion, quota pruning, and media purge.
- The only CSAM reference in BestChef runtime scope is that migration comment. There is no hash matching, preservation workflow, escalation queue, reporting integration, or operational runbook implemented in code.

**User impact:** public photo and video uploads can enter the system without automated safety review or a complete illegal-content response path.

**Required closure:** implement the full media worker, real provider integration, human escalation, evidence preservation, lawful reporting procedure, and a tested incident drill reviewed by qualified safety and legal specialists.

### C6. Submission images are public before moderation

**Confidence:** 10/10, local migrated database and source verified.

- Migration marks `bestchef-submission-images` public, `20260429000001_bestchef_cloud_feature_backfill.sql:7-17`.
- Storage policy grants anonymous and authenticated SELECT for the entire bucket, `20260428000016_storage_policies.sql:62-68`.
- The locally migrated database confirms `bestchef-submission-images|true` and an `{anon,authenticated}` SELECT policy.
- Finalize immediately returns `getPublicUrl()` with no moderation check, `modules/bestchef/src/cloud/submission-photo.ts:170-216`.

**Attack path:** a user uploads prohibited media, receives the public URL before review, and distributes it directly. Unlisted UUIDs are not access control.

**Required closure:** make the bucket private, serve owner previews with short-lived signed URLs, expose only approved derivatives through an authorization layer or CDN, and add an automated policy test proving anonymous pre-approval reads fail.

### C7. Account deletion fails open, destroys recovery data, and announces success

**Confidence:** 10/10, code traced.

- Cloud RPC, profile-delete, and sign-out failures are appended to warnings, `apps/bestchef/app/(root)/data/account.ts:213-249`.
- Local files, SQLite rows, and secrets are wiped unconditionally afterward, then `localWiped` is set true, `account.ts:252-254`.
- Settings always displays the title `Account deleted`, even when the server deletion request failed, `apps/bestchef/app/(root)/(tabs)/settings.tsx:210-220`.

**User impact:** a user can lose the only local copy and credentials while server data remains, with no durable receipt or retry path.

**Required closure:** obtain and persist a server deletion receipt before destructive local cleanup, keep a recoverable retry state, distinguish requested, completed, and failed statuses, and test every network and server failure branch.

### C8. Grocery-photo recognition fabricates results

**Confidence:** 10/10, code traced through the public-launch branch.

- The screen initializes `rawCandidates` with `SAMPLE_GROCERY_PHOTO_JSON`, `kitchen-photo.tsx:42`.
- Selecting a real photo clears those candidates only when a BYO API key exists, `kitchen-photo.tsx:103-108`.
- Public launch disables BYO provider keys.
- `createKitchenFoodPhotoReview()` prioritizes `rawCandidateJson` over the server vision broker, `data/kitchen.ts:1488-1499`.

**User impact:** a real grocery photo can return the bundled sample groceries instead of analyzing the image. Users can add false food and nutrition data to their pantry.

**Required closure:** remove sample data from production state, clear pasted candidates whenever a new photo is selected, require a real broker result or an honest failure, and add a public-build regression test with a non-sample image.

### C9. Empty recipe data is replaced with unrelated Pad Thai content

**Confidence:** 10/10, code traced.

- `SAMPLE_INGREDIENTS` and `SAMPLE_STEPS` contain a Pad Thai recipe, `recipe/[id].tsx:128-151`.
- Any submission with empty ingredients or steps receives those arrays, without `shouldShowDemoContent()`, `recipe/[id].tsx:382-389`.

**User impact:** the app can show false ingredients, allergens, instructions, nutrition, and grocery items for an unrelated dish.

**Required closure:** render a truthful missing-data state, never synthesize ingredient or instruction content, block nutrition and grocery derivation without source data, and test empty and partial cloud records.

### C10. Legal, support, and policy claims are not launchable

**Confidence:** 10/10 for technical facts; legal conclusions require counsel.

- App constants hardcode five `https://bestchef.app/...` legal and support routes, `constants/legal.ts:9-13`.
- `bestchef.app` and `www.bestchef.app` have no resolving A records. All five app routes are unreachable.
- Terms and privacy retain `[EFFECTIVE DATE]`, `[OPERATOR LEGAL NAME]`, `[HOSTING REGION ...]`, and `[GOVERNING LAW / VENUE]`, `apps/bestchef/legal/terms.md:3,7,112` and `privacy.md:3,6,66`.
- Terms and privacy claim automated upload screening and contracted classification providers, while current code uses stubs and has no general media worker, `terms.md:54` and `privacy.md:59-62`.

**User impact:** users cannot review binding terms, privacy, deletion, guidelines, or support. The text misstates how uploaded media is handled.

**Required closure:** qualified counsel must finalize the corpus against implemented behavior, the domain and every route must return a durable 200 response, support intake must be staffed and tested, and the in-app terms receipt must be durable server-side.

## High-severity blockers

| ID | Finding | Verified evidence | Required closure |
|---|---|---|---|
| H1 | Moderator console is not production-operational. | The console builds and has strong server-side `requireModerator` checks, but only `.env.example` exists; no deploy target, production URL, or current deployment evidence was found. The production backend it needs is inactive. | Deploy behind enforced admin auth and MFA, exercise every queue and appeal action against staging and production, and document an on-call moderation SLA. |
| H2 | Moderation queue claiming is not atomic. | Two workers can read the same queued row at `moderate_vote_proof/index.ts:532-552`; the PATCH has no `status=queued` precondition. The decision RPC locks the proof but does not reject an already-decided proof and inserts another audit row, `20260427000011...sql:270-370`. | Add an atomic claim RPC or conditional update, make the decision idempotent, and add concurrency tests. |
| H3 | The latest job-health migration drops security controls from health. | Integrity-floor health includes quota-prune scheduling, enabled action limits, and kill switch, `20260703000002...sql:807-823`. The later media-purge migration replaces the function and omits all three, `20260704000002...sql:145-160`. | Merge all fields into one canonical health function and add pgTAP assertions for required keys and fail-closed health. |
| H4 | Core navigation reaches a shipped placeholder. | Kitchen Recipes, Kitchen Videos, Grocery Recipes, Grocery Capture, and recipe Cook omit a route, `KitchenSliderShell.tsx:88-110`; all route to `/soon`, `:156-167`, whose copy says the workflow is not ready. | Implement and wire every action to its complete workflow; remove `/soon` from production reachability and add route-contract tests. |
| H5 | Challenge progress is wrong. | `votes_received` selects nonexistent `bc_submissions.vote_count`, `modules/bestchef/src/cloud/challenges.ts:517-525`; schema has `upvote_count` and `downvote_count`. `recipes_shared`, `dishes_cooked`, and `submissions` all return the same submission count, `:543-552`. Errors are ignored. | Define authoritative server-side metrics, expose an RPC, handle errors, and test each challenge type against seeded records. |
| H6 | Data export is local-only and misdirects users. | Export metadata declares `scope: 'device'`, `data-export.ts:1-6,79-88`; Settings uses the data-deletion URL as `fullAccountExportUrl`, `settings.tsx:232-237`. Cloud profile, social, moderation, and media records are omitted. | Build authenticated server export, include all account records and media manifests, supply a durable download, and exercise access, expiry, and deletion interactions. |
| H7 | Push notifications do not exist. | No `expo-notifications` dependency, APNs entitlement, push-token table, registration flow, or delivery worker exists in BestChef scope. The notification center is an in-app database feed. | Implement token lifecycle, permissions, localized payloads, server fan-out, invalid-token cleanup, preference enforcement, deep links, and delivery tests. |
| H8 | Localization gate reports false confidence. | `check-i18n-parity.mjs:30-48` compares key presence only. Independent AST comparison found 994 English keys, 55 to 107 values identical to English per non-English locale, and 52 keys identical across all 20 non-English catalogs. | Translate every value, add value-equality and script-quality gates, obtain native-language review for safety and store copy, and run visual/device QA for all advertised locales. |
| H9 | Barcode and commerce workflows are explicitly unfinished. | `kitchen-barcode.tsx:47-53` says camera capture is deferred and accepts manual digits. `modules/bestchef/src/cloud/grocery-delivery.ts:5` calls search and checkout stubs. `open-food-facts.ts:527` identifies the GS1 adapter as a stub. | Implement real camera scanning, licensed provider integrations, delivery search and checkout, error/recovery states, and production contract tests. |
| H10 | Production video delivery is not built. | Video upload sends the original up to 150 MiB with no client transcode, `media-upload-worker.ts:10-13,124`. Promotion uses a 365-day signed URL until a future CDN pipeline, `apps/bestchef-console/lib/media-promotion.ts:10-16`. | Add server transcode, metadata stripping, thumbnails, adaptive playback, CDN authorization, revocation, expiry rotation, and load tests. |
| H11 | Monetization code creates fake processor identifiers. | Tips write `pi_${Date.now()}`, `modules/bestchef/src/cloud/tips.ts:84`; subscriptions write `sub_${Date.now()}`, `subscriptions.ts:166`. No Stripe, RevenueCat, StoreKit, or IAP dependency or reachable payment caller exists. | Implement compliant store billing and processor webhooks, entitlement and refund state, receipts, tax and payout operations, or remove every monetization promise and surface. |
| H12 | Failures disappear instead of becoming operable signals. | Trending, Top This Week, and Restaurant Spotlight catch network failures and render nothing, `TrendingDishesChips.tsx:15-29`, `TopThisWeekCarousel.tsx:45-75`, `RestaurantSpotlight.tsx:73-87`. No Sentry, Crashlytics, Bugsnag, Datadog, OpenTelemetry, or equivalent runtime integration was found. | Add visible retry/error states, structured app and edge telemetry, queue and job alerts, release health dashboards, and an incident runbook. |
| H13 | The Edge Function TypeScript project is not green. | `pnpm exec tsc -p supabase/functions/tsconfig.json --noEmit` fails with four errors in `bestchef-vision` and `moderate_vote_proof` tests. | Fix all four errors and make this exact command a required CI and deploy gate. |

## Medium-severity findings

| ID | Finding | Evidence and closure |
|---|---|---|
| M1 | Production dependency audit is not clean. | `pnpm audit --prod` reports one moderate advisory, `js-yaml@3.14.2`, CVE-2026-53550 / GHSA-h67p-54hq-rp68, through Expo and React Native build/test tooling. Upgrade or override to `>=3.15.0`, regenerate the lockfile, and rerun audit plus builds. |
| M2 | iOS export passes with broken package export warnings. | Expo export succeeds with a 12.8 MB Hermes bundle but reports missing locale-data export targets from FormatJS plural and relative-time packages. Resolve versions and prove every locale boots without fallback resolution. |
| M3 | Console build has workspace and lint configuration drift. | Next.js selects `/Users/trey/package-lock.json` as workspace root and says its ESLint plugin is not detected. Set `outputFileTracingRoot`, remove ambiguity, and make the deployment build reproducible from a clean checkout. |
| M4 | Test breadth is large but release realism is weak. | Unit and local SQL suites pass, but the production smoke suite is skipped, no clean-device TestFlight run is bound to current code, and the module suite includes unrelated Edge Function tests. Add isolated BestChef CI, current-production smoke, two-account abuse tests, offline/recovery tests, and device automation. |
| M5 | Small public images are not proven free of location metadata. | `compressImage()` returns the original file unchanged when it is already under 12 MiB, `media-upload-worker.ts:72-82`; only larger images are re-encoded. Because submission images are public, prove metadata stripping for every path or strip server-side before exposure. |

## What passed

These are real strengths, not launch waivers.

| Check | Result |
|---|---:|
| BestChef app TypeScript | PASS |
| BestChef module TypeScript | PASS |
| Moderator console TypeScript | PASS, with Next workspace warning |
| App unit tests | 39 files, 328 tests passed |
| Module unit tests | 99 files passed, 1 skipped; 1,423 tests passed, 1 skipped |
| Console unit tests | 7 files, 55 tests passed |
| Local BestChef pgTAP | 10 files, 171 tests passed |
| Deno checks for 8 BestChef functions | PASS |
| iOS Expo production-config export | PASS, 12.8 MB bundle, FormatJS warnings |
| Console production build | PASS, configuration warnings |
| Root parity and generated-artifact gates | PASS |
| Secret scan | No tracked live `.env`, no current high-confidence key patterns, `.gitleaks.toml` present |
| Dependency audit | 0 critical, 0 high, 1 moderate |

The app also has useful RLS, action quotas, offline queues, server-only console credentials, and moderator authorization checks in source. Those controls become meaningful only after the real production plane is current, reachable, monitored, and tested.

## Security posture

### Attack surface

- Five user-authenticated Edge Functions broker media and AI work.
- Three worker-secret Edge Functions perform moderation, deletion, and purge.
- Public PostgREST and Storage surfaces depend on RLS and bucket policy.
- The iOS client accepts public UGC photos and videos and maintains an offline SQLite copy.
- The moderator console uses a service-role client on the server and guards sensitive routes with `requireModerator`.
- External dependencies include Supabase, Anthropic, Open Food Facts, USDA, and planned GS1 and commerce providers.
- Scheduled jobs cover ranking rebuilds, deletion, action-usage pruning, and media purge. Moderation is not scheduled.

### Verified security findings

1. **Critical, 10/10:** arbitrary CookProof media receives fixed safe classifier scores and can be approved.
2. **Critical, 10/10:** submission images are anonymously readable before moderation.
3. **High, 9/10:** non-atomic moderation claims permit duplicate or racing decisions and audit rows.

The scan found no active high-confidence credential pattern in current BestChef source or in the two history commits initially matched by broad prefix searches. Main CI actions are SHA-pinned; the monorepo relay image workflow uses tag-pinned actions but is outside the BestChef launch path.

This security pass is not a substitute for an independent penetration test, mobile application assessment, or specialist trust-and-safety review.

## Required resolution plan

Every workstream below is required before launch. The order reflects dependencies, not deferral.

### Workstream A. Restore and prove the production plane

1. Reactivate or provision the named BestChef production Supabase project. Give it an owned production name and access roster.
2. Export and review the current migration ledger. Apply the full ordered migration set to a clean staging clone, then production.
3. Deploy all eight Edge Functions from one release SHA. Assert deployed content hashes, versions, secrets, and JWT flags automatically.
4. Seed `bc_job_config`, schedule ranking, deletion, action-prune, moderation, and purge jobs, then repair `bc_job_health()` so every control is represented.
5. Run deletion, recovery, storage, RLS, provider quota, and moderation drills with real users and real objects.
6. Configure backups, point-in-time recovery, restore drills, logs, alerts, dashboards, and an on-call runbook.

**Exit evidence:** healthy DNS and database; migration parity report; function deployment manifest tied to SHA; `bc_job_health().healthy=true` with every expected field; successful backup restore; 48 hours of healthy job and queue telemetry.

### Workstream B. Make public UGC safe and legally supportable

1. Replace stub classifiers with real NSFW, food-likeness, face, and illegal-content screening providers. Fail closed.
2. Implement and schedule the general media worker. Add quarantine, human escalation, evidence preservation, appeals, and lawful reporting operations.
3. Make all pre-moderation buckets private. Mint owner preview URLs and publish only approved, sanitized derivatives.
4. Make moderation claims atomic and decisions idempotent. Test concurrent workers and human-worker races.
5. Deploy the moderator console with MFA, least privilege, audit retention, queue SLA, and emergency removal controls.
6. Have qualified counsel finalize terms, privacy, guidelines, deletion, age, region, processor, retention, and support language against the implemented system.
7. Host every legal route on `bestchef.app`, staff support, and test reporting and appeal response from the app.

**Exit evidence:** provider contracts and live test results; adversarial-media corpus results; zero anonymous reads before approval; concurrency proof; moderator drill; counsel approval; all legal/support routes return 200 and match the release.

### Workstream C. Remove fabricated and destructive behavior

1. Delete production sample defaults from grocery photo recognition and recipe detail.
2. Require real source data for nutrition, allergens, grocery derivation, and recipe steps. Show honest missing and retry states.
3. Redesign account deletion around a durable server receipt and recoverable retries. Wipe locally only when policy and user messaging are truthful.
4. Build a complete server-side account export with cloud data and media manifests.
5. Replace challenge counters with authoritative server metrics and surface errors.
6. Add explicit backend error and retry states to every home, feed, profile, and ranking surface.

**Exit evidence:** regression tests for every false-data and failure branch; deletion and export drills; seeded challenge proof; zero silent cloud failures in the clean-device launch matrix.

### Workstream D. Complete every advertised product workflow

1. Remove `/soon` from all reachable production actions and wire Recipes, Videos, Capture, and Cook to complete flows.
2. Connect Cook mode to real saved and community recipes without fallback steps.
3. Implement camera barcode scanning, licensed GS1 and food data behavior, grocery delivery search and checkout, and full recipe import.
4. Implement push registration, preferences, server delivery, localization, deep links, and cleanup.
5. Finish the production video pipeline with transcode, sanitization, adaptive playback, CDN authorization, and revocation.
6. Implement real StoreKit and processor-backed payments, subscriptions, tips, receipts, refunds, entitlements, and payouts, or remove those capabilities and claims everywhere.
7. Translate and professionally review all 20 advertised non-English catalogs. Add gates that inspect values, not only keys.

**Exit evidence:** route graph with no placeholder destination; workflow E2E tests; provider and payment sandbox-to-production proofs; push delivery matrix; video load tests; native-language signoff and screenshots.

### Workstream E. Produce a release that can be signed

1. Fix Edge Function TypeScript, dependency audit, FormatJS warnings, and console build configuration.
2. Run isolated BestChef CI from a clean clone: types, lint, tests, pgTAP, Deno, Edge TypeScript, iOS export, console build, dependency and secret scans.
3. Build a production IPA from the approved SHA and distribute it through TestFlight.
4. Execute clean-install, upgrade, offline, recovery, two-account abuse, localization, accessibility, performance, deletion, export, and moderation matrices on real devices.
5. Complete App Store privacy labels, age rating, screenshots, review notes, support URL, privacy URL, account deletion instructions, and export-compliance answers against the actual binary.
6. Run an independent penetration test and trust-and-safety review. Resolve every critical and high issue.
7. Assemble one immutable launch packet containing SHA, EAS ID, migrations, function manifest, environment fingerprint, test results, legal approval, store metadata, incident ownership, and rollback procedure.

**Exit evidence:** every command green; current TestFlight artifact passes; App Store package is complete; independent review closed; founder, engineering, security, trust-and-safety, legal, and operations sign the same packet.

## Final GO checklist

Launch remains denied until every box is checked with attached evidence.

- [ ] Production Supabase is active, named, reachable, backed up, and restore-tested.
- [ ] Hosted migration ledger equals the reviewed repository.
- [ ] All eight current functions are deployed with verified hashes and correct JWT flags.
- [ ] All scheduled jobs run and full `bc_job_health()` stays healthy for 48 hours.
- [ ] Real moderation and illegal-content handling pass an adversarial corpus and human drill.
- [ ] No media is anonymously readable before approval.
- [ ] Moderator console is deployed, protected, staffed, and tested.
- [ ] Deletion and full cloud export succeed under normal and failure conditions.
- [ ] Grocery photo and recipe detail never fabricate data.
- [ ] Challenge metrics are authoritative and tested.
- [ ] No reachable action lands on `/soon` or an unfinished screen.
- [ ] Barcode, imports, delivery, push, video, and payment capabilities are fully functional or absent from every claim and surface.
- [ ] All advertised languages are actually translated and device-reviewed.
- [ ] Legal and support URLs resolve, match code, and have counsel approval.
- [ ] App, module, console, SQL, Deno, Edge TypeScript, build, dependency, and parity gates are green.
- [ ] A current production IPA from the approved SHA passes the full real-device TestFlight matrix.
- [ ] App Store metadata and privacy disclosures match the binary and backend.
- [ ] Independent security and trust-and-safety reviews have no open critical or high findings.
- [ ] Launch packet, incident ownership, rollback, and canary procedures are signed.

## Verification ledger

| Command or check | Result |
|---|---|
| `git rev-parse HEAD` | `d3caa1fe3b51d0eb8897af28d27585883ab87952` |
| Scoped `git rev-list` after build commit | 58 commits |
| Scoped `git diff --shortstat 8a65bc8c..HEAD` | 314 files, +31,585 / -13,867 |
| Runtime diff after July 5 audit | No BestChef runtime change |
| `eas build:list --platform ios` | Newest store build is May 12, build 24, commit `8a65bc8c` |
| `supabase projects list --output json` | Production ref is `INACTIVE` |
| `supabase functions list --project-ref ...` | 7 functions, v3, updated April 29; purge missing; two worker JWT flags wrong |
| Production project DNS / HTTP | Does not resolve |
| `bestchef.app` DNS | Does not resolve |
| iTunes lookup, ASC ID `6763167108` | `resultCount: 0` |
| App/module/console typecheck | PASS |
| App/module/console tests | 328 / 1,423 / 55 passed, 1 module test skipped |
| `supabase test db` | 171 passed |
| `deno check` on 8 functions | PASS |
| Edge Function `tsc` project | FAIL, 4 errors |
| iOS Expo export | PASS with FormatJS warnings |
| Console production build | PASS with configuration warnings |
| Root parity and generated-artifact gates | PASS |
| Catalog AST value comparison | 52 keys English in every non-English catalog |
| `pnpm audit --prod` | 1 moderate, 0 high, 0 critical |

## Review limitations

- The production project being inactive prevented a live end-to-end production transaction. That is a launch failure, not a reason to assume the path works.
- App Store Connect private metadata, contracts, insurance, staffing, provider agreements, and counsel work cannot be proven from the repository. They require signed external evidence in the launch packet.
- No source review can replace a professional mobile penetration test, a qualified legal review, or a specialist public-UGC trust-and-safety assessment.

## Final ruling

**NO-GO.** Do not submit or open BestChef to production users. Re-review from current code and current hosted state only after every critical and high item is closed and the final checklist is backed by one release-specific evidence packet.
