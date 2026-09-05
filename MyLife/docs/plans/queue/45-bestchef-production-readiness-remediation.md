# Feature Spec: BestChef Production-Readiness Remediation

> Closes the gap list from the 2026-07-10 adversarial audit
> (`docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`). Takes BestChef
> from "strong substrate, launch-blocked on honesty/safety/legal/money" to public-GA-ready in
> all 21 shipped locales, plus a sequenced Indic expansion (bn/ta/te). Successor to plan 33;
> plan 33's engineering plumbing is done, this plan closes what its "DONE" claims did not cover.

## Metadata

- **Surfaces:** `apps/bestchef`, `apps/bestchef-console`, `modules/bestchef`, `supabase/`
  (migrations, edge functions, storage, config), `packages/module-registry`, `apps/mobile`
  + `apps/web` recipes hub, App Store Connect (founder-ops).
- **Priority:** A-Tier. BestChef is the suite's first public consumer launch; every blocker
  here is a hard gate, not a nice-to-have.
- **Mandates honored:** no-deferral (full function, no MVP framing), transport honesty
  (never fake a capability), server-backed public-launch exception (Supabase, never mesh).
- **Depends on (hard):** founder-ops F1-F7 from plan 33 (vendor accounts, legal hosting,
  translation review, store listings). No dependency on other queue plans.
- **Blocks:** any BestChef public wave; `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH`; App Store submission.

---

## Ground truth (2026-07-10, adversarially verified)

**Solid, protect it:** RLS across all 60 `bc_` tables; durable server-side rate limits;
JWT split; console service-role isolation + allowlist; contiguous v1..v33 migration chain;
4/5 offline sweepers mounted; video playback E2E works; slugify + paste-import fixed;
F-008/F-010 closed; CLDR plural + RTL + notification i18n engines real; all gates green and wired.

**Blocked on four themes:** content honesty (4 ungated fabrication sites), trust-and-safety
enforcement (public pre-moderation media + auto-approving stubs), legal compliance (unpublished
corpus, mislabeled export, missing child-safety reporting), money honesty (fake payment IDs).

---

## Tier 0: Safety, Legal, and Honesty Gates (blocks any public build)

The cheapest, highest-severity tier. Most are days of client/SQL work; the long pole is vendor
procurement (start F3/F5 in week 1, in parallel).

### 0.1 Kill fabricated user-facing output (audit C6-C9) — client, ~2 days
1. `kitchen-photo.tsx`: initialize `rawCandidates` to `''`; gate the `SAMPLE_GROCERY_PHOTO_JSON`
   prefill behind `shouldUseDemoFixturesInDev()`; in `reviewPhoto()` never pass `rawCandidateJson`
   unless demo content is allowed or the user explicitly pasted candidates; on a real photo with
   no provider, show an honest "recognition unavailable in this build" state.
2. `kitchen-receipt.tsx`: same treatment for `SAMPLE_RECEIPT_OCR_TEXT` (init + reset paths).
3. `expiration-photo.tsx`: same treatment for `SAMPLE_EXPIRATION_OCR_TEXT`.
4. `recipe/[id].tsx`: gate the `SAMPLE_INGREDIENTS`/`SAMPLE_STEPS` fallback behind
   `shouldShowDemoContent()` (match the adjacent gated `DEMO_DISHES` lookup); in production render
   an empty/"no ingredients provided" state.
5. Add a gate script `check:no-ungated-fixtures` (grep for `SAMPLE_`/`DEMO_` render sites lacking a
   `shouldShowDemoContent`/`shouldUseDemoFixturesInDev` guard) wired into `check:parity`, so this
   regression class is caught mechanically.
- **Acceptance:** in a `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` build, no kitchen/recipe screen
  presents any hardcoded sample; the new gate is green and enforced.

### 0.2 Close the media moderation model (audit C1, C2, C4) — SQL + edge, ~3-4 days
1. Migration: `bc_submissions.moderation_status` default → `'pending'`; add a with-check on
   `bc_submissions_insert` forcing `pending` for non-admins (or a BEFORE INSERT stamp).
2. Migration: make `bestchef-submission-images` `public=false`; add server-enforced size + MIME
   limits on submission-image/avatar buckets and reconcile `config.toml` drift (audit H18).
3. Client: serve approved submission images via short-lived signed URLs after
   `moderation_status='approved'` (mirror the videos/vote-proofs path); migrate existing objects.
4. Build + deploy a media-screening worker that drains `bc_moderation_queue` `kind='media_asset'`
   for all owner kinds and both media kinds; extend the console `/media` page to review image assets
   and comment/post owners.
- **Acceptance:** a freshly submitted recipe is NOT publicly visible until approved; an uploaded
  submission image is not fetchable by URL before approval; the console can action image assets.

### 0.3 Real classifiers + child-safety reporting (audit C3, C5; founder F3) — vendor + edge
1. Contract NSFW + food classifiers and a hash-match child-safety provider (Thorn Safer / PhotoDNA /
   Cloudflare CSAM). Wire real providers into `moderate_vote_proof` and the new media worker; keep
   fail-closed; stubs only under an explicit test env flag.
2. Run the hash-match screen before any public exposure of user images.
3. Wire the mandatory NCMEC/CyberTipline reporting workflow (18 U.S.C. §2258A) with required
   evidence retention; register the operator with NCMEC (founder).
4. Schedule/queue the vote-proof + media workers (pg_cron/pg_net like the deletion worker), so
   screening actually runs.
- **Acceptance:** a stranger's abusive upload is caught by a real classifier, queued, and decidable
  from the console within an hour; a hash-match hit triggers the reporting path; no stub approves in
  a production build.

### 0.4 Anonymous sybil hardening (audit C11) — SQL, ~2 days
1. Require a verified (non-anonymous) account, or a proof-of-humanity token, before a vote counts
   toward rankings; weight or quarantine anonymous votes.
2. Add device/account-age heuristics to the integrity floor; flag anonymous vote rings to the queue.
- **Acceptance:** N anonymous accounts from one device cannot move a leaderboard; anonymous votes are
  visibly weighted/quarantined.

### 0.5 Legal + compliance (audit H3, H4, H5; founder F2) — content + client
1. Fill the `[OPERATOR LEGAL NAME]` / `[GOVERNING LAW]` placeholders; host ToS, privacy, guidelines,
   data-deletion, support at the real `bestchef.app` URLs; verify `constants/legal.ts` URLs return 200.
2. Deliver a real GDPR Art. 20 export (server-side account data, not just local SQLite); fix the dead
   "full account export" link and the mislabeled "Export my data" copy.
3. Deliver statement-of-reasons to users on moderation decisions (DSA Art. 17) via the typed
   notification path, in the user's locale.
4. Translate the legal corpus for the launch locales (rides F5).
- **Acceptance:** legal URLs return 200; "Export my data" produces a real server-side export; a
  moderation decision sends a localized statement-of-reasons.

### 0.6 Money honesty (audit C10, H10, M5) — decision + client
Founder decision required (plan 33 says free-at-launch, non-paid creator program). Given that:
1. Remove the fabricated payment paths: delete or convert `apps/mobile/app/(recipes)/tip.tsx` and
   `subscription-tiers.tsx` to honest "coming soon" placeholders (no fake success, no "95% goes to
   the chef" claim); stop minting `pi_`/`sub_` IDs in `tips.ts`/`subscriptions.ts`.
2. Replace the Creator Dashboard fabricated revenue chart/stat with an honest empty/"not yet earning"
   state until real rails exist.
- **Acceptance:** no screen shows a fake payment success or fabricated revenue; grep finds no
  `pi_${Date.now()}`/`sub_${Date.now()}` in shippable code.
- **Alternative (if founder wants paid at launch):** wire StoreKit/RevenueCat (mobile) + Stripe
  (server) + creator payout UI as a full-function feature. Do not half-ship.

### 0.7 Deletion completeness + report durability (audit H11, H12) — client, ~1 day
1. Add `rc_media_upload_jobs`, `rc_saved_submissions_cache`, `rc_pantry_staples` to the account-
   deletion local wipe.
2. Mount `retryPendingReports` on the foreground/network-regain sweep like the other four sweepers
   (restores the B-003 guarantee).
- **Acceptance:** "Delete Account" leaves zero user rows in those tables; an offline report auto-retries
  without opening `/my-reports`.

**Tier 0 exit test:** a public build fabricates nothing; unmoderated media is never publicly
reachable; real classifiers + child-safety reporting are live; legal URLs return 200 with a real
export; no fake money; deletion is complete. This is the minimum for any wave.

---

## Tier 1: Launch Quality — 21-locale value-complete (blocks a quality launch)

### 1.1 Close the i18n value hole (audit H8, H9, M3, M4) — gate + content
1. Rewrite `check-i18n-parity.mjs` (or add `check:i18n-values`) to flag values byte-identical to EN
   beyond an allowlist of legitimate loanwords; wire into `check:parity` + pre-commit. This is the
   gate that has been blind to ~1,155 untranslated values.
2. Translate the 52-string batch across all 20 non-EN catalogs (rides founder F5 professional review;
   priority: the 7 targets zh-Hans/zh-Hant, es, fr, ja, hi, ko, then the rest).
3. Localize badge names/descriptions via `t('badge.<id>.name')` keyed by badge_id (fixed editorial
   set), or add per-locale columns to `bc_badge_definitions`.
4. Drive the language picker off the true untranslated-count; label carrying locales "Interface partly
   in English" until value-complete (fix M3).
- **Acceptance:** the value gate is green at the launch bar for all 21 locales; the picker is honest;
  no badge renders raw English.

### 1.2 RTL + fonts (audit M6, L4) — client
1. Replace the dev-only `DevSettings.reload` RTL restart with a production-safe reload (e.g.
   `expo-updates` reload or a native restart module) so ar/he RTL actually applies in release builds.
2. Bundle per-script font chains (iOS Hiragino Sans / Android Noto Sans JP for ja; script fallbacks)
   so non-Latin text uses the design typeface.
- **Acceptance:** an ar device relaunches into mirrored RTL in a release build; ja/zh/ko/hi render in
  a declared font.

### 1.3 Workflow + copy fixes (audit C12, M2, M7, M11, M12) — client + SQL
1. Fix `votes_received` challenges (`vote_count` → `vote_score`/sum `upvote_count`) + surface errors +
   regression test.
2. Thread video duration/width/height through finalize so feed cards show duration.
3. Reconcile the "Max 200 MB" copy with the real 150 MiB cap and add camera-path size/duration checks.
4. Add a cook-mode entry from saved (private) recipes.
5. Either add a camera scanner to match "Scan barcode", or rename to "Enter barcode".

### 1.4 Store metadata pipeline (audit M13; founder F6) — ops
Per-locale ASC listings (fastlane deliver or EAS metadata) for the 21 launch locales: titles,
keywords, localized screenshot captions, age ratings, privacy labels. Store copy lives in the i18n
corpus so the value gate covers it.

**Tier 1 exit test:** a German large-text user sees a reflowed, translated, AA-contrast UI end to end;
ar renders mirrored in release; the store listing exists in all 21 locales.

---

## Tier 2: Scale + Ops Infrastructure (blocks sustained traffic)

- **2.1 Media scale (audit H6, H7; founder F4):** Supabase Pro CDN + image transforms; video through a
  streaming provider (Cloudflare Stream vs Mux) delivering HLS; client-side video compression; add the
  signed-URL re-sign/rotation job (H6) before the first expiry cohort.
- **2.2 Observability (audit H14):** Sentry (app + edge), structured function logs, automated alerting
  on job health / quota denials / moderation queue depth; incident runbook; backup/restore drill.
- **2.3 Push (audit H13):** expo-notifications + APNs entitlement + `bc_push_tokens`; extend the typed
  notification fanout to enqueue localized-at-send pushes (rank-change is the flagship).
- **2.4 Job-config automation (audit M9, M8):** idempotent `scripts/seed-bc-job-config.mjs` upserting the
  three required rows from env; gate prod deploys on `bc_job_health().healthy=true`; add the missing
  media-purge rows to the console checklist.
- **2.5 Analytics (audit L7):** privacy-respecting analytics (self-hosted PostHog or aggregate events)
  before any paid acquisition, so waves produce learning.
- **2.6 Security hardening (audit H1, L1):** fix the `searchChefs` `.or(ilike)` filter injection (use the
  parameterized RPC pattern already applied to dish search); constant-time worker-secret compares.

## Tier 3: Hub Parity + Cleanup (blocks "parity-complete" claims)

- **3.1 (audit H2, M15):** either wire the hub mobile/web `recipes` module to the same cloud engines the
  standalone uses, or explicitly document BestChef-in-hub as a scoped offline adapter (not parity-complete)
  per the Standalone And Module Parity rule, and set `requiresNetwork` accurately.
- **3.2 (audit H17):** update `MODULE_METADATA` and the parity test to reference "BestChef", not the
  pre-rebrand "MyRecipes".
- **3.3 (audit H16):** reconcile the ticket ledger (F-045/046/047 are not closed).
- **3.4 (audit M10):** add explicit `device_local` syncPolicy rules for the six V29-V33 local tables.
- **3.5 (audit M14):** audit ATT against actual SDK behavior; confirm the privacy manifest.
- **3.6 (audit L8, L10):** disambiguate migration timestamps; scope the module test glob to BestChef.

## Tier 4: Indic Expansion (post-launch market wave)

Add Bengali (bn), Tamil (ta), Telugu (te) as full launch-value catalogs (994 keys each, professional
review), matching the Hindi bar. Sequence as an India market wave after Tier 0-1, gated on the value gate
(1.1) and font chains (1.2) covering the new scripts. Not a launch defect for the current 21.

---

## Founder-Ops Ledger (cannot be done by agents)

- **F1** Dashboard-verify prod project; push `20260529000005` + `20260610000001` to prod; apply the
  7 deploy-gate migrations to staging + prod before build 25.
- **F2** Host `bestchef.app` legal pages (Tier 0.5 writes content).
- **F3** Contract NSFW + child-safety vendors and register with NCMEC (blocks Tier 0.3).
- **F4** Supabase Pro + streaming provider choice (blocks Tier 2.1).
- **F5** Translation review vendor for the launch catalogs (blocks Tier 1.1).
- **F6** App Store Connect: 21 storefront listings, age ratings, privacy labels (blocks Tier 1.4).
- **F7** Approve per-market editorial seed personas + content provenance.
- **F8** Money decision (Tier 0.6): confirm free-at-launch / non-paid creator, or fund real rails.
- **F9** Protected BestChef cadence for the launch window (burst-and-starve is the schedule meta-risk).

## Verification

- Per change: `pnpm gate:function:changed`, `/review`; UI tiers add `/browse` + `/design-review`.
- Suites: app + module tests, typechecks, `pnpm check:parity` (now including the new fixture and
  i18n-value gates), `check:generated-artifacts`.
- Tier exit tests as written above. No wave ships until Tier 0 is fully green.

## Risks

- **Vendor lead time (highest):** F3 (child-safety + classifiers) and F5 (translation) are external and
  gate Tier 0.3 / Tier 1.1. Start both in week 1 regardless of code progress.
- **Cadence:** burst-and-starve. The new fixture/value gates make regressions loud; F9 protects time.
- **Scope honesty:** full function per the founder mandate; the only sequencing freedom is market waves,
  never feature stubs. The Tier 0.6 money decision is the one place a smaller scope (remove fake rails) is
  the honest path, not a deferral.
