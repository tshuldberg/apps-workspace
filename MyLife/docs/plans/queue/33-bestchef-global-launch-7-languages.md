# Feature Spec: BestChef Global Launch (7+ Languages, 14 Storefronts)

> BestChef launch plan 33. Takes BestChef from its current state (stale TestFlight build 24,
> inactive production backend, English carryover below the UI string layer) to public GA in 7 launch
> languages (en, es, pt-BR, fr, de, it, ja) across 14 storefronts, with the client and
> backend architecture built full-function so the remaining 14 shipped catalogs (incl.
> ar/he RTL and pl/ru-class plurals) become rollout decisions, not engineering projects.
> Grounded in the 2026-07-03 adversarial review, whose findings are incorporated
> into this plan. The current code-and-hosted-state verdict is
> `docs/reports/REPORT-bestchef-production-launch-gate-2026-07-09.html`.

## Metadata

- **Surfaces:** `apps/bestchef` (app, i18n, design system), `modules/bestchef`
  (cloud engines, taxonomy, notifications), `supabase/` (migrations, edge functions,
  config), `packages/ui` (Text primitive), `.github/workflows` + `.husky` (gates),
  App Store Connect assets (founder-ops).
- **Priority Score:** 44 / 50 (A-Tier). BestChef is the suite's first true public
  consumer launch; every week idle decays seed content and store knowledge.
- **Estimated CC Time:** 12-16 weeks at demonstrated solo-founder-plus-agents cadence;
  ~9-11 focused build weeks if BestChef gets protected time. Phases A-D of the
  2026-07-02 eval map onto Phases 1-6 here.
- **Depends On (hard):** founder-ops ledger items F1-F9 (dashboard verification, vendor
  accounts, legal hosting). No dependency on other queue plans.
- **Blocks:** any BestChef public wave; App Store featuring pitch; paid acquisition.
- **Mandates honored:** founder no-deferral rule (full function, no MVP framing);
  BestChef server-backed public-launch exception (Supabase path, no mesh transport on
  launch-critical flows); transport-honesty rule (never fake capability).

---

## Business Context

### Why now

Concept is validated at 8.5/10 across two independent evals. The failure mode is not
product-market fit, it is a floor of trust-and-safety, localization, and operational
truth that does not exist yet. The 2026-07-02 eval's 15 blockers all still stand;
the adversarial re-review added 17 more, several of which (backend English notification
layer, non-Latin slug crash, cosmetic vote integrity) would be discovered by users and
press in the first week of a global launch. Meanwhile the repo has had zero BestChef
commits in 23 days: the "burst and starve" cadence is the meta-risk this plan must
survive, which is why Phase 0 wires gates before anything else.

### Launch shape (from the 2026-07-02 eval, confirmed)

- **Languages:** en, es, pt-BR, fr, de, it, ja. Architecture ships full-function so
  ar/he (real RTL pass) and pl-class plurals are unlocked by this plan's engine work,
  with their market waves sequenced later as rollout decisions.
- **Storefronts, 4 waves:** Wave 0 soft launch CA/AU/IE (EN); Wave 1 US/UK (NCMEC live);
  Wave 2 ES/MX, BR, FR/BE, DE/AT/CH, IT; Wave 3 JP (fonts + moderation coverage first).
- **Per-country age gates:** DE/IE 16, FR 15, IT/ES 14, default 13.
- **Monetization:** free at launch, creator program non-paid. Unchanged.

---

## Ground Truth Baseline (2026-07-03, adversarially verified)

Green and real: typecheck + 290 app tests + 1135 module tests; CHF-1 durable provider
quota fully wired fail-closed; RLS sane on all sensitive tables; secrets clean;
account-deletion flow complete in code; demo fixtures fail closed; anonymous-first auth.

Broken or missing (prior eval blockers 1-15 all valid, plus N1-N17): backend
notifications hardcoded English in SQL; `slugify()` crashes non-Latin dish creation;
stub classifiers auto-approve everything; proof-hash dedup per-submission; free
delete+revote; no durable social rate limits; ~105-key untranslated compliance block in
all non-Latin catalogs; 13-key EN drift live with the parity script wired to nothing;
no fonts loaded at all; no push; no CDN/transcoding; day-1 Vote/leaderboard dead ends;
errors swallowed to empty; Dynamic Type unclamped; contrast failures; F-008/F-010
`/soon` stubs; bookmarks device-local; `.env.local` staging-wired; `bc_job_config`
silent no-op; `verify_jwt` deploy trap; `bc_media_variants` read leak; client-only
block enforcement; 200MB vs 150MiB video mismatch; zero store metadata; stale ledgers.

---

## Status Delta (2026-07-03, session 2)

Phase 0 complete (session 1). Session 2 shipped, all verified on live local
Postgres (supabase test db, 125 pgTAP) + module 1150 + app 303 vitest:

- **Phase 1.2 DONE** (`50efdad8`, `cfe042e9`): bc_proof_hash_ledger global
  per-user proof dedup (survives vote delete), cross-user reuse flags,
  bc_delete_vote throttle + 24h recast cooldown, bc_consume_action_quota
  engine enforced on votes/comments/reports/follows/likes/uploads (RPCs +
  BEFORE INSERT triggers; old clients keep working), error codes localized.
- **Phase 1.5 DONE** (in `50efdad8` + `d7e9b465`): bc_blocked_between wired
  into visibility/read policies/write paths; block stores reconciled
  (cloud wins, local mirrors).
- **Phase 1.7 DONE**: legal corpus at `apps/bestchef/legal/` (attorney
  placeholders only: operator name, governing law; founder F2 hosts);
  per-country age gates (GDPR Art. 8 table) live in onboarding; DSA Art. 20
  appeals (bc_appeals + RPCs + My Reports UI).
- **Phase 2.1 DONE**: bc_notifications params jsonb, all 6 bc_notify_* stop
  storing English, activity view exposes params, client renderer + 23 keys.
  Activity view keeps legacy title/subtitle until build 25 is the floor.
- **Phase 5.1 partial / 5.3 / 5.4 partial** (`2dfbe57a`): Dishes + Vote
  error+retry states, Vote/leaderboard cold-start submit CTAs, @mylife/ui
  Text 1.4x Dynamic Type clamp, saffron-surface ink AA-verified (#33200F).
- i18n this session: +75 keys in ALL 21 catalogs, parity 100%.

- **Phase 1.3 DONE (2026-07-03, session 3, `81189d94`)**: moderator console
  shipped as `apps/bestchef-console` (separate internal Next.js app;
  service-role key server-only, zero NEXT_PUBLIC_*). Supabase magic-link/OTP
  login (existing accounts only, founder decision) + fail-closed email
  allowlist (BESTCHEF_CONSOLE_MODERATOR_EMAILS) enforced in middleware +
  every page + every action. Vote-proof queue (cross-user hash-reuse
  badges, signed-URL evidence with tri-state rendering), flags + photo
  reports (one-click decisions via bc_apply_moderation_decision, sibling
  bookkeeping), appeals queue (bc_resolve_appeal, reverse-BEFORE-resolve
  ordering so failed reversals stay retryable), bc_job_health panel, ops
  levers (kill switches + bc_action_limits editing with zero-row-update
  assertions). Language filter column present, activates with 2.5.
  Decision targets always re-derived server-side from bc_flags/bc_appeals;
  attribution via console_moderator decision metadata. 46 lib tests;
  3-agent adversarial/security/testing review applied (18 findings fixed).
  Founder-ops: deploy to its own private target + set 5 BESTCHEF_CONSOLE_*
  env vars + Supabase redirect URL (README documents all).

- **Phase 2.2 DONE (2026-07-03, session 3, `a8594bcb`)**: all 7 edge
  functions audited. Server: validation rejections carry fine-grained codes
  + params (file_too_large/unsupported_media_type with limits), envelopes
  gain optional `error.params`. Client: `edge-errors.ts` parses the machine
  envelope out of FunctionsHttpError.context (previously invisible;
  clients showed English literals); `media-errors.ts` maps kinds to typed
  `{ code, message (natural i18n key), retryable, params }`;
  vote-proof/submission-photo/provider-broker rewired. App: reviewed-vote
  + submit gate on retryable (permanent rejections never queue
  forever-retrying drafts), copy via t(message, params). +10 keys x21
  (872 total, 100%). Adversarially reviewed (13 findings, 4 critical,
  all fixable ones fixed). Old-client statuses/shapes unchanged.
  Founder-ops: redeploy bestchef-media-upload + moderate_vote_proof
  (staging + prod) to serve the new params.
  FLAGGED follow-up (from review, pre-existing): `drainPendingProofs` is
  exported but never called by app code, so offline vote-proof drafts do
  not auto-retry despite 'The vote will retry.' copy; wire a sweep
  (foreground/network-regain) or fix the copy in Phase 3.3 client work.

- **Phase 2.3 DONE (2026-07-03, session 3, `eac5f25d`)**: bc_dish_translations
  (unique dish+locale, lowercase tags, RLS approved-or-admin read /
  admin-only write, updated_by attribution) + bc_search_dishes RPC
  (parameterized locale-aware search; exact tag beats BARE base language,
  sibling regions never cross, untagged aliases match all locales, tagged
  ones exact-or-base only; replaces the injectable client-side .or(ilike)
  search). Module searchDishes rides the RPC with localized display fields
  + dishDisplayName/localizeDish; app catalog follows the i18n language
  with locale-keyed caching; hub submit picker/dish browser keep
  own-pending findability via status:null; console /dishes editorial page
  (20 locales, upsert/delete/status). Adversarially reviewed (8 findings,
  3 critical fixed incl. a 100-row clamp that silently truncated the
  200-dish catalog). pgTAP 143 green on live local Postgres.
  Scale note for Phase 4: replace leading-wildcard ilike scans with
  pg_trgm gin indexes once the catalog grows past a few thousand rows.
  Founder-ops: migration 20260703000005 rides the F1 prod/staging push.

- **Phase 2.5 DONE (2026-07-04, session 3, `21b98506`)**: language columns on
  submissions/snapshots/comments (lowercase tags, null = untagged pre-2.5
  rows, always visible unfiltered), feed index, queue-metadata stamp
  trigger (console proof-queue language filter now LIVE), module write
  tagging (publish/alias/comment/swap) + feed/leaderboard language filters
  composing with region (per-market boards), Vote-feed language pill with
  epoch-guarded fetches + honest filtered-empty state, leaderboard
  My-language toggle, +6 keys x21 (878). Adversarially reviewed
  (10 findings, 1 critical toggle race fixed). pgTAP 151.
  DEPLOY GATE (binding): migrations 20260703000002..000006 MUST be applied
  to staging AND prod BEFORE build 25 ships - new clients write the
  language column unconditionally and an unmigrated environment rejects
  every publish/comment (PGRST204). Rides F1.
  Scale note: language check constraints use plain ADD CONSTRAINT (full
  validate); use NOT VALID + VALIDATE post-launch on large tables.
  Phase 3.3 note: alias bridge tags with the CURRENT app language, not
  authoring-time language; persist language on local rc_ rows when Phase 3
  touches the local schema. drainPendingProofs sweep still pending (2.2).

- **Phase 2.6 DONE (2026-07-04, session 3, `dc389342`) - PHASE 2 COMPLETE**:
  dish emoji keyword map is a precedence-ordered multilingual table (21
  locales) + extraNames matching (native/localized names) in
  getDishEmoji/getDishVisuals; DishVisual + catalog adapter pass names;
  new sushi/pizza/burger/pasta concepts. Matching engine hardened per
  adversarial review (11 findings, 4 critical): word-boundary + plural
  variants for Latin keywords (no 'sup'-in-'Supreme' class), banh above
  noodles ('Banh mi' is a baguette), CJK compounds not bare 面/麵,
  NFC + Turkish case folding, per-name matching. The Phase 2 exit test is
  now fully architected: German devices get zero platform-authored
  English (typed notifications, machine error codes, dish translations,
  language-filtered UGC, native-name emoji).

- **Phase 3.1 DONE (2026-07-04, session 3, `553d7c1b`)**: the ~81-key
  untranslated compliance block (N4) translated with real copy in all 20
  non-English catalogs (~1,540 values replaced in place, placeholders
  preserved). Post-pass audit: every non-Latin catalog at ZERO
  untranslated prose; Latin residuals are legitimate loanwords. Founder
  F5 professional review still applies on top (3.8).

- **Phase 3.2 DONE (2026-07-04, session 3, `ad878241`)**: all N15
  hardcoded-string classes routed through t()/tp() (+31 keys x21, 909
  total): rank badge + Follow, raw Alerts (RTL restart prompt renders in
  the TARGET language), 9 a11y labels, stat labels, pantry expiration
  family (module helper composed English; screen now renders tp copy) +
  pantry filter keys that never existed in catalogs, ErrorBoundary crash
  screen (hook-free localization via the seeded app-language holder).
  NEW GATE: scripts/check-raw-strings.mjs (raw Alert.alert /
  accessibilityLabel / prose placeholders) wired into check:parity next
  to the i18n parity gate; clean on first run.

- **Phase 3.3 DONE (2026-07-04, session 3, `291a1433`)**: localized
  dates/relative time + the offline vote-proof sweep. relativeTimeParts +
  Intl.RelativeTimeFormat (compact "2h" Hermes fallback; RTF presence on
  device is still unverified, fallback covers absence) in notifications
  and profile activity; 'now' key x21 (910 keys, 100% parity); app
  language threaded into 5 date sites; print-template en-US pin replaced
  by a locale option; postal-code copy de-US-ified (en/hi) and the
  settings input accepts alphanumeric codes. drainPendingProofs got its
  first production caller: proof-sweep on cloud-ready/foreground with
  app-id -> cloud-UUID resolution (permanent vs transient), background
  retryable rate_limited/auth on ALL legs, shared expo-file-system
  reads. Local schema V30: rc_local_vote_proofs gains media_asset_id
  (retries skip the upload leg, no orphaned assets/quota burn) and
  verdict/rating/notes (offline reviews survive). Two adversarial review
  rounds, 9 findings, all fixed in-commit. Follow-up `01f16535`: local
  schema V31 stamps authoring-time UGC language on rc_bestchef_submissions;
  the alias bridge prefers the stored tag over the current app language
  (closes the 2.5 alias-language note; offline retries already preserved
  the enqueued payload). ChefTom seed rows stamp 'en'. Local schema now
  v31. Known limit (pre-existing substrate): cross-version mesh sync
  changesets fail on schema-skewed peers (mesh is not the launch path).

- **Phase 3.5 DONE (2026-07-04, session 3, `8ec3fa22`)**: full CLDR plural
  categories. translatePluralized selects catalog '#zero|two|few|many'
  variants: real ar dual/paucal/accusative, he duals, pl few/many
  declension for 9 plural pairs; bare-noun duals stay plain plural (digit
  renders outside tp - review caught the doubling). Rank deltas + upvote
  counts + pantry photo counts route through the engine. @formatjs
  PluralRules + RelativeTimeFormat polyfills (guarded, 21 locales) wired
  first in the root layout - Hermes lacks both natively, which would have
  left 3.3 relative time AND every 3.5 variant inert on device. PARITY
  GATE HARDENED: extractor now parses double-quoted and \u-escaped keys;
  6 keys were invisible + untranslated in 20 catalogs for months
  (backfilled with real copy) and '1 photo'/'{count} photos' never
  existed in ANY catalog (raw English in pantry). 964 keys x21 at 100%.
  Adversarial review: 4 findings, all fixed in-commit.

- **Phase 3.6 DONE (2026-07-04, session 3, `44a1c6ea`)**: RTL pass.
  DirectionalIcons wrappers (scaleX mirror under I18nManager.isRTL) with
  all 41 directional-icon files swept through them; numeric columns flip
  alignment; restart-flow copy confirmed localized (3.2). Kitchen slider
  made direction-coherent (review HIGH: physical gestures vs mirrored
  icons cross-wired every left/right action for ar/he) - gestures map to
  logical directions, exit animation flips back to physical, a11y labels
  announce the localized PHYSICAL swipe word (direction_* x21, 968 keys).
  NEW GATE: check:rtl-icons (raw directional icon JSX + physical
  textAlign) in the check:parity chain. Snapshot-check note: the plan's
  Playwright line does not apply to the Expo app; regression coverage is
  the static gate + wrapper contract instead. Media galleries/vote deck
  verified free of physical-direction indicators.

- **Phase 3.7 DONE (2026-07-04, session 3, `81304541`) - PHASE 3
  ENGINEERING COMPLETE (3.8 = founder F5 vendor)**: honest completeness.
  Generator extracts safety-surface keys (reporting/appeals/blocking/age
  gate + curated settings/comments entry points) into committed
  compliance-keys.ts (70 keys); check:compliance-keys gate in the parity
  chain + pre-commit trigger on safety files. Picker/onboarding mark a
  locale partial when ANY safety key is untranslated (localized sub-label)
  regardless of overall %. Guard test pins all 21 locales at exactly 1.
  Generator exposed 16 hidden gaps, all backfilled with real copy: 9
  safety strings absent from EVERY catalog (age-gate consent 'I agree',
  zero-tolerance policy, community rules, report-failure, recovery) and 6
  report categories as English passthroughs x20 (Harassment/Violence/
  Copyright/Other/Back/No). 978 keys x21 at 100%. Review fixes: sub-label
  overflow, he consent legal wording, ar harassment term, deterministic
  sort, curated-key usage validation. Known limits (recorded): value-
  differs heuristic accepts any non-EN value (F5 vendor review is the
  quality gate); scope = the designated safety files + curated extras.

- **Phase 5.6 DONE (2026-07-04, session 3, `c11594e1`)**: F-008 + F-010
  closed for real (both previously reopened tickets). bc_saved_submissions
  (owner-only read RLS, CHF-1 'save' quota, DSAR manifests updated) + 14
  pgTAP; V32 local mirror (schema v32) with optimistic pending-op queue +
  foreground sweep; toggle/sweep resolve app-local ids via the alias
  bridge; vote-tab legacy settings-blob saves migrated onto the same
  engine; /saved screen from profile. Feed viewmodel carries real
  comment_count + chefProfileId; video comment button routes into the
  cloud comments engine; chef pill + localized system share wired; /soon
  gone from the video feed. 987 keys x21. DEPLOY GATE: migration
  20260704000001 rides F1 with 20260703000002..6 (must reach staging AND
  prod before build 25). Review: 4 findings fixed in-commit (GDPR
  inventory, id-resolution wedge, dual bookmark stores, RLS-blank chef
  names via bc_public_profiles_v).

- **Phase 5.5 DONE (2026-07-04, session 3, `6a8485c8`)**: trophy moments.
  Submit-success: Top-100 competing pill + Share action. First CookProof:
  one-time celebration toast (tier-truthful copy - review killed the
  false 'counts 3x' claim). Rank changes: Home banner renders the newest
  unread rank_up/rank_milestone via the localized copy engine,
  focus-refetched, marks read on dismiss. Review CRITICAL: the
  HERO_GRADIENT object-cast device crash (errors_log 2026-05-04)
  reintroduced + 3 latent casts on the submit success sheet - all killed,
  regression test now app-wide. Review HIGH: buildTargetRoute pointed 4/5
  notification targets at dead routes - every bell-tap deep link fixed
  (/chef, /recipe, /(tabs)/profile, /challenge). 992 keys x21.

- **Phase 4.4 DONE (2026-07-04, session 3, `f1682391`)**: durable
  submission media upload queue (BCSERVER-P0-04). rc_media_upload_jobs
  (schema v33): claim-based state machine (no concurrent double-
  processing), throw-safe drain with 5-attempt budget, cooperative
  cancel with guarded terminal writes, app-death requeue, settled-row
  pruning. Photos: compression ladder to the 12MiB cap, NATIVE hashing
  (review P0: the JS base64 reader would jetsam-kill on big videos and
  crash-loop; videos send null hashes - server accepts). Publish shows
  live progress + Cancel; ONE photo path for publish/retry/offline
  (review: dual pipelines double-uploaded). Videos upload in the
  background keyed by the cloud submission - HONEST OPEN ITEM: assets
  sit private/pending in bc_media_assets; the video feed needs the Phase
  4.1 promotion step (founder F4: moderation approval flips visibility +
  writes playable remote_url). Picker cap aligned to 150MiB. 13 state-
  machine tests; 995 keys x21.

- **Post-4.4 sweep (2026-07-04, session 3, `7949c33b` + `f37b1ed1` +
  `8e1dc49a`)**: the 4.4 follow-ups closed. Pending-submission sweeper
  MOUNTED (was exported, called nowhere) with media-queue payload
  reconciliation. VIDEO FEED END-TO-END without waiting for F4: console
  /media queue reviews pending submission videos (signed previews,
  required statement of reasons) and approval routes through
  bc_apply_moderation_decision (review HIGHs: staff-email leak into
  world-readable metadata + hand-rolled updates that made rejections
  unappealable) then attaches a 365-day signed playback URL;
  bestchef-media-finalize guarded against decision laundering. TS-04
  purge worker SHIPPED + scheduled (bc_run_media_purge_worker daily,
  bc_job_health extended): deletions purge immediately, rejections only
  after a 183-day appeal-evidence window (review HIGH: DSA Art. 20).
  Phase 4.2 bucket audit documented
  (docs/designs/bestchef-storage-buckets.md). OPEN ITEMS RECORDED:
  re-sign job before the first signed-URL expiry cohort (mid-2027);
  takedown URLs live until purge; ops must seed
  media_purge_worker_secret in bc_job_config per environment. DEPLOY
  GATE now: 20260703000002..6 + 20260704000001..2 before build 25.
  Phase 4 remainder (4.1 CDN/transcode + re-sign job, 4.3 push) is
  founder/vendor-gated.

- **Appeal-reversal re-promotion DONE (2026-07-04, session 3,
  `f3c17963`)**: restored video rejections re-attach their playback URL
  via the shared lib/media-promotion.ts helper; failures land in the
  /media recovery queue and purged-object cases surface honestly.

- **Phase 5.7 SURFACED (2026-07-04, session 3)**: the three IA taste
  calls are mocked and awaiting founder letters (A/B per call) at
  https://claude.ai/code/artifact/1712e100-e3df-457e-9b11-08ff5d251f84 -
  (1) tab bar over capacity: five tabs with Dishes second + Top 100
  folded into Dishes vs keep seven; (2) Vote deck + feed.tsx redundancy:
  one full-screen surface with a Vote/Watch mode vs keep both; (3) accent:
  green #22C55E vs terracotta #C9894D primary. Recommendations: A/A/A.
  The raw-hex-to-token collapse rides on whichever screens the chosen
  build touches. WITH THIS, EVERY CODEABLE PLAN-33 ITEM IS DONE OR
  AWAITING A FOUNDER/VENDOR INPUT.

Still open in Phase 1: 1.1 classifiers (vendor F3), 1.4 text moderation
(vendor), 1.6 observability (vendor Sentry + F1).
Phase 2: COMPLETE (2.1-2.6; 2.4 slugify landed in Phase 0).
Phase 3: ENGINEERING COMPLETE (3.1-3.7; 3.4 fonts done in Phase 0;
3.8 professional review is founder F5 vendor work).

## Phase 0: Truth and Gates (repair the process before the product)

The cheapest phase and the one that stops every regression class seen so far.

1. **Wire the i18n parity gate.** Add `check:i18n-parity` script to root and
   `apps/bestchef/package.json`; call it from `.husky/pre-commit` (scoped to bestchef
   changes) and the CI `parity` job. Repair the 13 missing keys in all 20 catalogs.
2. **Reconcile the ticket ledger.** Fix `Tickets/README.md` summary table (56/3
   contradiction); reopen F-008 and F-010 honestly (video-feed comments, cloud
   bookmarks) since they route to `/soon`.
3. **Refresh the server-launch mission control** (`bestchef-server-launch-mission-control.md`):
   mark P0-05 real, record the prod ref, keep P0-04/08/09/10 honest.
4. **Environment truth.** Document the EAS env contract (which EXPO_PUBLIC_* the
   production profile must carry) in `eas.json` comments + CLAUDE.md; add a build-time
   assertion script that fails an EAS production build wired at a non-prod ref
   (today it fails only at runtime). Remove Android from `app.json` `platforms` and
   config (no native project exists); declare iOS-first in docs.
5. **Deploy-flag capture.** Encode `--no-verify-jwt` for `bestchef-delete-account` and
   `moderate_vote_proof` in `scripts/deploy-functions.sh` (N6) with a comment explaining
   the worker-secret gate, so the trap cannot recur.
6. **Job health visibility.** Add a `bc_job_health` check (RPC or admin query + app-side
   admin surface later in Phase 1's console) that surfaces: bc_job_config rows present,
   pg_cron/pg_net available, last ranking rebuild time, oldest `requested` deletion age.
   Kills the N5 silent no-op class.

**Acceptance:** parity script green and enforced; ledger and mission control match code;
a staging-wired production build fails in CI, not on device; deploy script encodes JWT
flags; job health queryable.

## Phase 1: Trust, Safety, and Integrity Floor (blocks any wave)

1. **Real classifiers.** Wire a production NSFW model and CSAM hash-match + NCMEC
   reporting path into `moderate_vote_proof` and media-finalize (vendor per founder F3).
   Keep fail-closed. Replace stub defaults with provider calls; stubs remain only under
   an explicit test env flag.
2. **Vote integrity hardening (N3).**
   - Proof-hash dedup becomes per-user global: `unique(user_id, content_hash)` plus a
     cross-user hash-reuse flag into the moderation queue.
   - Throttle `bc_delete_vote` (durable per-user daily cap) and make recasts re-enter
     moderation with a cooldown.
   - Durable rate limits on votes, comments, reports, follows, uploads: one
     `bc_consume_action_quota` RPC in the CHF-1 pattern (ledger + caps + kill switch),
     enforced inside the write RPCs, not the client.
3. **Moderator console.** Minimal internal Next.js surface: report/proof queues by
   language, evidence via existing signed-URL path, one-click decisions via existing
   RPCs, DSA statement-of-reasons fields, appeals queue. Includes the Phase 0 job-health
   panel.
4. **Text moderation.** Multilingual toxicity screen on comments, stories, handles, and
   dish proposals feeding the same flag queue.
5. **Authorization fixes (N13, as corrected).** The `bc_media_variants` read policy is
   sound (its EXISTS subquery composes with parent-asset RLS); no change needed there.
   Enforce blocks server-side (RLS or RPC filters referencing `bc_blocks`); reconcile
   the two block stores (cloud wins, local mirrors).
6. **Observability + incident floor (P0-09).** Sentry (app + edge), structured function
   logs, alerting on job health + quota denials + moderation queue depth, backup/restore
   drill, one-page incident runbook.
7. **Legal corpus (P0-08).** Publish EN ToS, privacy, guidelines, data-deletion, support
   pages at the real URLs in `constants/legal.ts` (founder F2 hosts); per-country age
   gate table wired into the onboarding gate (DE/IE 16, FR 15, IT/ES 14, else 13);
   DSA appeal surface in-app (`my-reports` extension).

**Acceptance (exit test):** a stranger uploading abusive content is caught by a real
classifier, queued, decidable from the console in under an hour, with a statement of
reasons; one photo cannot vote twice anywhere; 100 rapid votes/comments hit durable
limits; deletions and rankings provably ran in the last 24h; legal URLs return 200.

## Phase 2: Backend Localization Architecture (before any non-EN user exists)

1. **Notifications become codes (N1).** New schema: `bc_notifications` gains
   `type` + `params jsonb`; all `bc_notify_*` RPCs and `bc_profile_activity_v` stop
   writing English and write type+params; clients render from catalogs (new keys for
   every type, all 21 catalogs, parity-gated). Backfill existing rows to typed form.
   `to_char(...,'Mon DD')` and digest dates move client-side.
2. **Edge functions return error codes** (machine keys + params), clients render
   localized messages. Audit all 7 functions.
3. **Dish translation layer.** `bc_dish_translations` (dish_id, locale, name,
   description, moderation status) with locale fallback to canonical; locale-tagged
   `bc_dish_aliases` become the per-language search layer (query filters by locale +
   fallback); admin/editorial write path via console.
4. **Fix `slugify()` (N2).** Unicode-safe slugs: transliterate where possible, else
   `dish-<short-hash>` fallback; never empty; backfill-safe; unit tests over ja/ko/ar/
   zh/th/hi/tr names (Turkish dotless-i included). Review `lower()`/`ILIKE` search paths
   for collation safety and index use.
5. **UGC language tagging.** `language` column on submissions, recipe snapshots,
   comments (default from author app-locale, overridable); feed + leaderboard queries
   accept a language filter; per-market leaderboard pages ("Best carbonara in Italy")
   using the existing region kind.
6. **Emoji/visual keyword maps** stop matching English-only names (extend to
   translations/aliases).

**Acceptance (exit test):** a device set to German receives zero platform-authored
English: notifications, errors, dish names, dates all localized; a dish named 寿司
creates cleanly twice; feed filtered to pt-BR shows only pt-BR-tagged UGC.

## Phase 3: Client Localization Completion

1. **Translate the compliance block (N4).** The ~105-key shared English block (age gate,
   deletion, reporting, creator verification, legal) translated in ALL 21 catalogs, not
   just launch 7; these surfaces are compliance-critical everywhere.
2. **Kill hardcoded strings (N15).** Route through `t()`: vote-card `#{rank} THIS WEEK`
   + `Follow`, SubmitSuccessView stat labels, all TextInput placeholders, Alert.alert
   literals, hook/data-layer error strings, `expiration.ts` day-count helper, hardcoded
   a11y labels. Add an ESLint rule or grep-based gate for raw JSX string literals in
   `app/(root)` to hold the line.
3. **Dates, numbers, relative time.** All `toLocaleDateString`/`toLocale*` calls take
   the app language (kill both `'en-US'` pins); wire `formatRelativeTime` (currently
   dead) into notifications/activity time-ago; metric/imperial render toggle using the
   existing kitchen conversion engine; de-US-ify defaults (postal code field, sample
   city placeholders, region samples localize per market).
4. **Fonts (N8).** Actually load Plus Jakarta Sans via expo-font/useFonts at root;
   declare per-script chains (iOS Hiragino Sans, Android Noto Sans JP for ja; system
   fallbacks per script) in `typography.ts`; fix `getRoundedFontFamily` unregistered
   family.
5. **Plural engine, full CLDR.** `tp()` accepts per-category keys (zero/one/two/few/
   many/other) with catalog support; migrate the 5 call sites; pl/ar/ru catalogs get
   correct forms. Unlocks the trailing locales for real.
6. **RTL pass.** Consume `isRtl` where layout demands it (chevrons, progress bars,
   carousels, numeric alignment); audit forceRTL restart flow copy (currently English);
   Playwright/RTL snapshot checks for the top 10 screens. Makes ar/he launchable.
7. **Honest completeness.** Raise the partial-locale threshold (or compute against
   compliance-critical keys separately) so the language picker stops calling
   English-safety-surface locales complete.
8. **Professional review pass** of the 6 non-EN launch catalogs (founder F5 vendor,
   ~807 keys each; priority it, ja, de, fr, es, pt-BR).

**Acceptance (exit test):** parity gate green at 100 percent for launch locales
including the compliance block; a German large-text user sees reflowed, translated,
AA-contrast UI end to end; ja renders in a declared font; ar renders mirrored correctly
on the top 10 screens.

## Phase 4: Media, Push, and Scale Infrastructure

1. **Media pipeline (blocker 8).** Supabase smart CDN + image transforms (Pro feature,
   founder F4 enables); video through a streaming service (founder decision Cloudflare
   Stream vs Mux) delivering HLS ladders; client-side video compression on upload;
   reconcile 200MB app cap vs 150MiB bucket (N14) and add camera-path size/duration
   checks; ship the missing `bestchef-media-purge` worker (TS-04).
2. **Bucket audit.** Revisit the 2 public buckets (avatars, submission-images): either
   document the public-by-design decision with moderation-gated writes, or move behind
   signed URLs + CDN. No silent contradiction with "private + signed" claims.
3. **Push notifications (blocker 9).** expo-notifications + APNs entitlement +
   `bc_push_tokens` (token, locale, platform); extend the (now typed) fanout RPCs to
   enqueue localized-at-send pushes; rank-change push is the flagship use case.
4. **App upload queue (BCSERVER-P0-04).** Compression, progress, retry, cancel,
   offline persistence for submission media; aligns with the existing submit draft
   resilience.

**Acceptance (exit test):** a 100MB phone video uploads compressed, transcodes, and
plays in ~2s on European LTE as HLS; losing a rank fires a localized push; a media
delete propagates through variants, CDN, and purge worker.

## Phase 5: Product Design Launch Pass (from the design review)

1. **Cold start is a designed state, not an accident (N7).** Day-1 market experience:
   Vote empty state becomes an invitation (localized copy + "Be the first" submit CTA);
   leaderboard empty state gets a submit button; home cold state gets a market-seeded
   "founding chef" framing. Viewer-to-voter-to-submitter ladder with progressive
   disclosure.
2. **Per-market seed catalogs (blocker 11).** Generalize the ChefTom editorial pattern:
   one persona per launch market, 50-100 dishes each, authored in-language and metric,
   loaded into prod cloud rows (founder F7 approves content provenance; render policy
   already supports approved editorial provenance). Beachhead dish per market (IT
   carbonara, FR coq au vin, JP curry rice).
3. **Error-state pass (N9).** Distinct error + retry on dishes, vote, home cards
   (template: `leaderboard.tsx:557`); no catch-to-empty anywhere in `(root)`.
4. **Dynamic Type + contrast (N10).** `maxFontSizeMultiplier` clamp in `@mylife/ui`
   Text; audit fixed-height/numberOfLines clusters for reflow; fix white-on-saffron to
   AA (scrim or darker ink).
5. **Trophy, not chore.** Submit-success gains the existing ShareCard + "you are now
   competing for Top 100" rank framing; first-CookProof celebration; rank-change moment
   in-app (pairs with Phase 4 push).
6. **Finish the stubs for real (no-deferral).** F-008 video-feed comments (reuse the
   existing cloud comments engine on the feed surface) and F-010 bookmarks backed by a
   `bc_saved_submissions` table synced with local cache; remove `/soon` deflections;
   feed viewmodel carries real comment counts.
7. **IA cleanups.** Promote Dishes (the canonical object) to a visible surface (tab or
   first-class home section, founder taste call surfaced with mocks); resolve the
   Vote-tab vs `feed.tsx` redundancy (one full-screen video surface with a vote mode);
   single accent decision (green vs terracotta) + collapse raw hex to tokens on touched
   screens.

**Acceptance (exit test):** a brand-new user in an empty market reaches a submit flow
from every empty state in one tap; `/soon` is unreachable from shipped surfaces;
design QA (`/design-review`) passes on the 7 core screens at default and XL type sizes.

## Phase 6: Store Ops and Market Waves

1. **Store metadata pipeline (blocker 12, N17).** Per-locale metadata directories
   (fastlane deliver or EAS metadata): listings, keywords, screenshots (localized
   captions), age ratings; store copy lives in the i18n corpus so the parity gate
   covers it. Featuring kit with CookProof gallery hero.
2. **Release evidence packet (P0-10).** Signed checklist per wave: gates green, prod
   env verified, legal live, classifier live, console staffed, rollback plan.
3. **Privacy-respecting analytics (blocker 13)** before any paid acquisition
   (self-hosted PostHog or aggregate events), so waves produce learning.
4. **Waves.** Execute Wave 0 (CA/AU/IE, 2-week bake), Wave 1 (US/UK + NCMEC live +
   UK OSA risk assessment written), Wave 2 (ES/MX/BR/FR/BE/DE/AT/CH/IT with seed
   catalogs + beachhead dishes), Wave 3 (JP after font + moderation coverage).
   Waves gate on evidence, not dates.

---

## Founder-Ops Ledger (cannot be done by agents)

- **F1.** Dashboard-verify prod project `zjxabnazbdocrqpyixgo`: region (record it in
  repo), secrets, buckets, deployed functions, `bc_job_config` rows both envs; push
  migrations `20260529000005` + `20260610000001` to prod.
- **F2.** Host bestchef.app legal pages (Phase 1 writes content).
- **F3.** Choose + contract classifier vendors (NSFW: Hive/Rekognition/Azure; CSAM:
  Thorn Safer/PhotoDNA/Cloudflare) and register with NCMEC.
- **F4.** Supabase Pro plan (image transforms + smart CDN); choose Cloudflare Stream
  vs Mux.
- **F5.** Translation review vendor (~$8k one-time, 6 locales).
- **F6.** App Store Connect: 14 storefront listings, age ratings, App Privacy labels
  match the manifest.
- **F7.** Approve per-market editorial seed personas + content provenance.
- **F8.** Decide prod region posture (stay us-west + CDN vs eu-central-1 migration)
  once F1 records reality.
- **F9.** Protected BestChef cadence for the launch window (the 23-day idle gap is the
  plan's biggest schedule risk).

## Verification

- Per change: `pnpm gate:function:changed`, `/review`; UI phases add `/browse` +
  `/design-review`; suites: app + module tests, 4 typechecks, `pnpm check:parity`,
  `check:generated-artifacts`, and the new i18n parity gate.
- Phase exit tests as written above; Wave 0 exit is 2 weeks of real reviews/reports
  handled within the published SLA.

## Risks

- **Cadence risk (highest):** burst-and-starve. Mitigation: Phase 0 gates make drift
  loud; F9 protected time; each phase leaves the repo shippable.
- **Vendor lead times** (classifiers, translation review) hide inside Phases 1-3 only
  if F3/F5 are kicked off in week 1.
- **Backend i18n migration** (Phase 2.1) touches stored rows; do it before non-EN users
  exist or accept an ugly backfill. This ordering is load-bearing.
- **Scope honesty:** this plan builds full function per the founder mandate; the only
  sequencing freedom is market waves, never feature stubs.
