# BestChef Production Launch Mission Control

Date: 2026-04-25

Last updated: 2026-04-26

Status: Internal beta ready with caveats. Public production launch is blocked.

Verdict: Do not public-launch BestChef until all P0 gates are closed and the P1 public-beta controls are explicitly signed off.

Scope: Standalone BestChef Expo app, `@mylife/bestchef`, Supabase BestChef cloud, provider integrations, legal/compliance, App Store and Play Store operations, moderation, support, observability, and release process.

Canonical rule: Active standalone BestChef is the canonical product surface. Durable business logic belongs in `modules/bestchef`; the standalone app should own Expo Router UI and thin data adapters.

Server launch plan: Continue launch execution from `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`. Public launch must use a standard server-backed path with Supabase Auth, Postgres/RLS, Storage, Edge Functions, and server jobs. Local-only device communication, peer transport, BLE, WebRTC, and mesh relay are not launch-critical paths for BestChef public users.

## Readiness Summary

BestChef is strong enough for internal beta and TestFlight dogfooding. The current build, UIUX contract, app tests, module tests, typecheck, parity check, and production dependency audit passed in the 2026-04-25 review.

BestChef is not ready for public production because the remaining risks are operational and user-facing, not just code completeness:

- Identity is anonymous beta auth only, with no public account recovery or account-linking story.
- Demo and seed content still powers public-looking social surfaces. Demo cloud alias writes are now production-guarded, but public seed policy and content approval remain blocked.
- Media submission uses local photo/video URIs, while cloud submission aliases only preserve HTTPS media.
- OCR, AI, USDA, and GS1 paths still expose client-side optional provider keys or direct client provider calls.
- Legal URLs, privacy disclosures, provider disclosures, UGC policy, nutrition disclaimers, and store metadata are not launch-final.
- Moderation schemas and helpers exist, but operator surfaces, review staffing, takedown process, and abuse response are not complete.
- Screenshot evidence and manual accessibility/device QA are still pending for the Kitchen Intelligence surfaces.
- Edge Functions, storage buckets, rate limits, observability, backup/restore drills, and release runbooks remain launch work.

## Launch Gates

| Gate | Launch decision | Required state |
|------|-----------------|----------------|
| Gate A: Internal beta | Allowed with caveats | Current green verification remains green. Anonymous auth, labeled seed content, BYO provider keys, and limited ops are acceptable only for internal testers. |
| Gate B: Public beta | Blocked | P0 items closed. P1 items either closed or explicitly waived by product, legal, engineering, and support owners. |
| Gate C: General availability | Blocked | P0 and P1 closed. External approvals, monitoring, incident response, moderation staffing, release evidence, and store compliance complete. |

## P0 Launch Blockers

### BCPROD-P0-01: Production Identity, Account Linking, and Recovery

Priority: P0

Owner: Engineering, Product, Support

Status: In progress. Production identity foundation, native callback handling, and a local service-role deletion worker scaffold are implemented. Public launch remains blocked on external auth provider setup, production Supabase environment, worker deployment/secrets, staging deletion drill, and device QA.

Evidence:

- `apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx:63` signs users in anonymously.
- Anonymous beta auth is documented as enabled for BestChef staging in `memory.md`.
- `supabase/migrations/20260426000007_bestchef_account_lifecycle.sql` adds account deletion request tracking, lifecycle audit events, identity status RPC, and profile merge check RPCs.
- `apps/bestchef/app/(root)/data/account.ts` now wipes all local BestChef account tables, local account media, known sync secrets, and can request cloud deletion before local wipe.
- `apps/bestchef/app/(root)/(tabs)/settings.tsx` exposes account status, email linking, recovery email, and cloud-aware delete account flow.
- `docs/runbooks/bestchef-account-lifecycle-runbook.md` documents account linking, recovery, deletion, and anonymous merge checks.
- `apps/bestchef/app/(root)/data/auth-links.ts` handles PKCE, implicit session, token-hash, and recovery callback shapes for native deep links.
- `apps/bestchef/app/(root)/data/launch-environment.ts` blocks public/production BestChef builds from accidentally using staging Supabase config unless explicitly marked as internal-only.
- `docs/runbooks/bestchef-supabase-environment-runbook.md` records that EAS development, preview, and production currently point to staging, so public production remains blocked.
- `supabase/migrations/20260426000008_bestchef_account_deletion_worker.sql` preserves deletion request audit rows after Auth user deletion.
- `supabase/functions/bestchef-delete-account/index.ts` scaffolds the server-only deletion worker with worker-secret gating, service-role Auth deletion, Storage object cleanup, media row deletion marking, and completed/failed metadata.

Required work:

- Choose the public auth model: Apple Sign-In is required for iOS if other third-party login exists. Email OTP and Google are product/legal decisions.
- Finish device verification for native deep-link callback handling for email link and recovery confirmations.
- Support linking an anonymous beta profile to a durable account without losing local recipes, submissions, votes, comments, media cache records, or kitchen data. Local/app foundation exists, but this still needs device verification against production Supabase auth.
- Add account recovery and device reinstall behavior.
- Deploy the service-role deletion worker for Supabase Auth users and Storage objects, with secrets configured only server-side.
- Run profile ownership transfer checks for previously anonymous `bc_*` rows using `bc_profile_owned_row_counts` and `bc_profile_merge_conflicts`.
- Verify delete-account removes or anonymizes cloud profile, submissions, comments, votes, reports, media, local SQLite data, media cache files, and provider preferences in staging.
- Keep support runbook current for account recovery, deletion, and identity merge failures.

Acceptance criteria:

- Fresh install can create a durable user account.
- Existing anonymous beta install can link to durable auth without losing local or cloud data.
- Reinstall on the same user can restore cloud identity and expected profile state.
- Account deletion completes across local database, media cache, Supabase auth, public profile, cloud submissions, and storage records.
- RLS tests cover anonymous, linked user, authenticated user, moderator, and admin paths.
- Support has a documented recovery and deletion procedure.

Verification:

- Fresh install auth smoke test on iOS device.
- Anonymous-to-durable account migration test.
- Reinstall restore test.
- Delete-account test with cloud row and storage verification.
- Supabase RLS tests for all roles.
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef test`
- `pnpm check:parity --quiet`

External dependencies:

- Apple Developer Sign in with Apple configuration.
- Supabase auth provider configuration.
- Published data deletion support URL.

### BCPROD-P0-02: Demo Content, Seed Content, and Public Data Policy

Priority: P0

Owner: Product, Engineering, Legal

Status: Local no-public-seed path complete. Public launch mode suppresses demo social content and blocks demo cloud aliases unless an approved seed revision is configured. Editorial seed import/rollback remains blocked until Product and Legal supply approval evidence.

Evidence:

- `apps/bestchef/app/(root)/data/demo.ts:75` defines demo dishes.
- `apps/bestchef/app/(root)/data/demo.ts:102` defines demo submissions.
- `apps/bestchef/app/(root)/data/demo-videos.ts:1` imports demo dishes and chefs.
- `apps/bestchef/app/(root)/data/cloud-submissions.ts:128` bridges demo submission ids into hosted cloud aliases.
- `modules/bestchef/src/cloud/public-data-policy.ts` defines seed approval, rollback, render-decision, and public media URL helpers.
- `apps/bestchef/app/(root)/data/public-data-policy.ts` blocks demo cloud alias writes by default in production or public-launch builds unless an approved seed revision is configured.
- `apps/bestchef/app/(root)/data/public-render-policy.ts` suppresses demo social rendering in production/public launch unless an approved seed revision is configured.
- `apps/bestchef/app/(root)/data/__tests__/public-data-policy.test.ts` covers public launch, internal beta, explicit allow, explicit block, and missing seed approval behavior.
- `apps/bestchef/app/(root)/data/__tests__/cloud-submissions.test.ts` verifies demo aliases are not written when the public data policy blocks them and local `file://` media is not forwarded to cloud alias writes.
- `apps/bestchef/app/(root)/data/__tests__/public-social-routes.test.ts` statically guards `DEMO_` imports in public social routes.
- `supabase/migrations/20260427000010_bestchef_public_data_policy.sql` adds HTTPS-only public `photo_url` checks for `bc_dishes`, `bc_submissions`, and `bc_comments`.
- `docs/runbooks/bestchef-public-data-policy-runbook.md` defines public seed content requirements, launch flags, and verification steps.

Required work:

- Keep launch default as no public seed content unless Product and Legal choose an approved editorial/partner seed plan.
- If seed content is used, add a production seed import job with provenance, rights, license, chef attribution, moderation status, approval revision, and rollback.
- Use the approved seed render helper to label approved editorial seed content on every public surface.
- Keep local user-submission alias behavior server-mapped, with media/storage policy completion still required by P0-03/P0-04 deployment evidence.

Acceptance criteria:

- Public app has no unlabeled fake users, fake submissions, fake votes, fake comments, or fake challenge activity.
- Production seed content has rights, source, attribution, and moderation records.
- Build-time or test-time guard catches accidental demo imports in public launch paths.
- Product signs off on all launch seed content.
- Public `bc_*` social rows reject local device media URIs at write time.

Verification:

- Static scan for `DEMO_` imports in production routes.
- `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` public-data policy guard test.
- Public social smoke test with seed-disabled and seed-enabled modes.
- Cloud seed rollback test.
- Legal/product approval artifact linked from release evidence.
- 2026-04-27 local verification passed static demo-route scan, public-data/render policy tests, seed approval/rollback helper tests, file-scoped function gates, full app/module tests, UIUX, parity, and generated-artifact checks.

External dependencies:

- Content rights review.
- Editorial seed content approval, if used.

### BCPROD-P0-03: Media Upload, Storage, Moderation, and Public Delivery

Priority: P0

Owner: Engineering, Cloud/Ops, Moderation

Status: Local server scaffold started. Hosted buckets, function deployment, app queue wiring, moderation approval, and device upload drills are still blocked or incomplete.

Evidence:

- `apps/bestchef/app/(root)/data/local-submissions.ts:295` persists `photo_uri` from local submission state.
- `apps/bestchef/app/(root)/data/cloud-submissions.ts:95` maps local `submission.photoUri` into the cloud submission payload.
- `modules/bestchef/src/cloud/submission-alias.ts:38` only preserves values that start with `https://`.
- `docs/sessions/2026-04-25-bestchef-kitch-f019-f021-cloud-cache-sync-policy.md:58` says product evidence upload/storage jobs and moderation operator surfaces remain separate launch work.
- `supabase/config.toml` now declares local private BestChef Storage buckets for submission media, thumbnails, evidence, receipts, and quarantine.
- `supabase/functions/bestchef-media-upload/index.ts` creates signed upload URLs and pending private `bc_media_assets` rows.
- `supabase/functions/bestchef-media-finalize/index.ts` finalizes uploaded assets without approving public delivery.
- Function tests cover auth rejection, URL rejection, bucket routing, size limits, profile ownership, and pending/private finalize state.

Required work:

- Create hosted Supabase Storage buckets for submission images, submission videos, product evidence, receipt evidence, thumbnails, and private quarantine assets.
- Deploy signed upload/finalize Edge Functions with service-role secrets kept server-side.
- Add malware/abuse scanning hooks, quota enforcement, idempotent retries, image compression, video compression or transcode policy, thumbnail generation, variant records, public URL approval/promotion, and CDN policy.
- Add media moderation states: private draft, uploaded, scanning, pending review, approved, rejected, removed, deleted.
- Public feeds must render only approved public media URLs. Private file URIs and storage keys must never enter public deltas.
- Add deletion propagation for user delete-account, moderator takedown, and storage cleanup.
- Add offline retry and user-visible upload status.

Acceptance criteria:

- Fresh user can submit a recipe with photo and optional video. Media uploads, survives app reinstall, and appears only after the allowed moderation state.
- Local `file://` URIs never appear in cloud public rows, public deltas, logs intended for support export, or share payloads.
- Failed upload can retry without duplicate public submissions.
- Rejected media is hidden from public surfaces and can be appealed or replaced according to policy.
- Delete-account removes or anonymizes media records and deletes storage objects according to the retention policy.

Verification:

- Device upload test for photo and video.
- Offline-to-online upload retry test.
- Public feed test before and after moderation approval.
- Supabase storage object inspection.
- Public delta privacy test.
- Delete-account media cleanup test.
- Abuse scanning failure fixture.
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef test`

External dependencies:

- Supabase Storage project configuration.
- CDN/cache policy.
- Moderation vendor or internal review staffing decision.
- App Store and Play Store user-generated media policy review.

### BCPROD-P0-04: Legal, Policy, Nutrition, Privacy, and Store Compliance

Priority: P0

Owner: Legal, Product, Support, Engineering

Status: Not started

Evidence:

- `apps/bestchef/app/(root)/(tabs)/settings.tsx:359` links the Privacy Policy row.
- `apps/bestchef/app/(root)/(tabs)/settings.tsx:368` still uses a before-public-launch terms fallback.
- Locale catalogs still contain English launch fallback strings for privacy and terms.

Required work:

- Publish final Privacy Policy at `bestchef.app/privacy`.
- Publish final Terms of Service at `bestchef.app/terms`.
- Publish data deletion instructions and support contact page.
- Publish UGC policy, community guidelines, moderation policy, report/appeal policy, and repeat-infringer policy.
- Publish nutrition and AI disclaimer covering OCR uncertainty, source conflicts, serving conversions, allergen limitations, and medical advice limitations.
- Publish provider disclosure for AI/OCR, USDA FoodData Central, Open Food Facts, GS1, and any analytics or crash-reporting provider.
- Complete Apple App Privacy labels and Google Play Data Safety forms.
- Confirm age rating, export compliance, content rights, account deletion compliance, and nutrition/health claim wording.
- Replace in-app fallback copy with working links and final localized text, or restrict launch locales to reviewed languages.

Acceptance criteria:

- All legal and support URLs return HTTP 200 from production domain.
- In-app Privacy Policy, Terms, Support, Data Deletion, Community Guidelines, and Report flows open working URLs.
- App Store Connect privacy labels match actual data collection, provider sharing, and retention.
- Google Play Data Safety is complete if Android public launch is in scope.
- Legal signs off on nutrition, AI/OCR, UGC, and content rights language.

Verification:

- URL check for all legal/support pages.
- In-app link test on iOS and Android.
- Store metadata review checklist.
- Legal approval artifact linked in release evidence.
- Locale review report, or launch-locale restriction.

External dependencies:

- Legal counsel.
- Domain/web hosting for `bestchef.app`.
- App Store Connect and Google Play Console access.
- Support inbox or helpdesk.

### BCPROD-P0-05: Moderation, Reporting, Safety Operations, and Abuse Response

Priority: P0

Owner: Product, Moderation, Support, Engineering

Status: Minimum SQL/function launch ops path complete locally. Production staffing, admin UI, and external rate-limit enforcement remain incomplete.

Evidence:

- `modules/bestchef/src/cloud/moderation.ts` contains moderation helpers and workflow logic.
- `modules/bestchef/src/cloud/schema.sql` defines moderation-owned server surfaces.
- `supabase/migrations/20260427000011_bestchef_moderation_ops.sql` adds authenticated reporting, role-gated audited decisions, previous/new state, and vote-proof audit alignment.
- `apps/bestchef/app/(root)/components/ReportMenu.tsx` exposes user reporting and uses the cloud reporting RPC for public launch targets.
- `docs/runbooks/bestchef-moderation-ops-runbook.md` documents the minimum SQL/RPC ops path and the remaining admin UI gap.
- `docs/sessions/2026-04-24-bestchef-server-blockers-core-hub.md:46` lists admin moderation workflows, rate limits, observability, backup/restore drills, and launch legal/policy URLs as remaining work.

Required work:

- Build full moderator/operator UI for submissions, comments, reports, product contributions, product evidence, media reports, appeals, and repeat offenders.
- Add operator convenience actions beyond the P0 SQL path: lock comments, block user, mute user, escalate, appeal, and annotate.
- Enforce abuse thresholds and rate limits for submissions, comments, votes, reports, profile edits, media uploads, and provider calls at the server/API-gateway layer.
- Define moderation SLAs, staffing model, escalation paths, appeal windows, and support macros.
- Add notification templates for rejected content, takedowns, and account actions.
- Add internal safety playbook for illegal content, harassment, spam, copyright, privacy leaks, and food safety/medical misinformation.

Acceptance criteria:

- Minimum launch ops can triage, approve, reject, hide, remove, restore, and dismiss content through role-gated RPCs without service-role secrets in the Expo bundle.
- A reported submission/comment can be hidden from public surfaces while under review.
- All moderation decisions write audit events with actor, target, reason, timestamp, and previous/new state.
- Abuse thresholds are documented; production enforcement and dashboards remain required before high-scale public traffic.
- Support can inspect audit evidence, with appeal/support UI still remaining.

Verification:

- Local `supabase/tests/bc_moderation_ops.sql` covers report-to-hidden, non-admin rejection, queue closure, and audit state.
- Local `supabase/tests/bc_vote_proofs.sql` covers vote-proof audit state.
- Module tests cover content moderation transitions and rate-limit constants.
- Manual staging QA remains required for appeal/restore, support evidence export, and production role claims.
- Support runbook review remains required.

External dependencies:

- Moderation staffing and escalation owner.
- Support inbox/helpdesk.
- Policy approval.

### BCPROD-P0-06: Provider Architecture for OCR, AI, Nutrition, and Product Identity

Priority: P0

Owner: Engineering, Legal, Cloud/Ops

Status: Partial local provider abstractions, public production architecture incomplete

Evidence:

- `apps/bestchef/app/(root)/kitchen-photo.tsx:170` asks for an optional vision API key.
- `apps/bestchef/app/(root)/kitchen-photo.tsx:180` asks for an optional USDA API key.
- `apps/bestchef/app/(root)/kitchen-photo.tsx:190` asks for an optional GS1 endpoint.
- `apps/bestchef/app/(root)/kitchen-photo.tsx:199` asks for an optional GS1 API key.
- `apps/bestchef/app/(root)/expiration-photo.tsx:206` asks for an optional vision API key.
- `modules/bestchef/src/pantry/food-recognition.ts:298` documents direct Claude Vision identification.
- `modules/bestchef/src/db/nutrition.ts:170` warns to keep API keys out of client bundles and repositories.

Required work:

- Decide production provider model: server-side provider broker, on-device only, disabled in public launch, or staged rollout behind server flags.
- Remove BYO provider key UI from production builds unless legal/product explicitly approves a power-user beta mode.
- Add Edge Functions for OCR, food recognition, nutrition lookup, provider credential storage, provider timeouts, retries, circuit breakers, and rate limits.
- Redact sensitive receipt/payment data before provider calls.
- Log provider usage without storing raw sensitive images or raw OCR text beyond approved retention windows.
- Add provider outage UX and deterministic fallback paths.
- Confirm license and attribution rules for USDA, Open Food Facts, GS1, and AI provider outputs.
- Add cost budgets and per-user/provider quotas.

Acceptance criteria:

- Production users do not enter third-party API keys into the app.
- Provider credentials are server-owned or the feature is disabled.
- Receipt payment data is redacted before provider use.
- Provider outage returns clear user-facing recovery actions without corrupting pantry/grocery state.
- Source attribution and confidence are displayed wherever provider data drives nutrition or product identity.
- Provider call costs and failure rates are observable.

Verification:

- Production bundle scan for provider key input placeholders.
- Provider outage fixture test.
- Receipt payment redaction fixture test.
- Edge Function integration test against provider sandbox or mocked provider.
- Cost and rate-limit dashboard review.
- Legal/provider approval artifact.

External dependencies:

- AI/OCR provider account and data processing terms.
- USDA data.gov API key policy.
- GS1 subscription and legal approval, if used.
- Open Food Facts API policy and attribution review.

### BCPROD-P0-07: Release Branch, Evidence Packet, and Launch Signoff

Priority: P0

Owner: Release Owner, Engineering, Product, QA, Legal, Support

Status: Not started

Required work:

- Freeze a release branch after P0 code and docs close.
- Capture a full release evidence packet with green commands, EAS build ids, TestFlight build number, Supabase migration state, legal URLs, store metadata, support runbooks, moderation runbook, backup/restore drill, and known issues.
- Define go/no-go meeting participants and signoff authority.
- Require written approvals from Engineering, Product, QA, Legal, Support, and Moderation.
- Record launch caveats and rollback criteria.

Acceptance criteria:

- Release packet exists in docs or release artifacts.
- Every required command is green on the release branch.
- EAS production build is tied to a git SHA and release notes.
- Supabase production migration state is recorded.
- Legal/support/moderation approvals are explicit and dated.
- Rollback and incident runbook are linked.

Verification:

- Release branch check.
- Git SHA to EAS build id mapping.
- TestFlight install and smoke test.
- Supabase migration status capture.
- Signoff artifact review.

External dependencies:

- App Store Connect access.
- EAS production credentials.
- Release owner assignment.

## P1 Public-Beta Hardening

### BCPROD-P1-01: Visual QA, Accessibility QA, and Device Screenshot Evidence

Status: Partially complete. Kitchen Intelligence Phase 9 simulator screenshot evidence is done. Broader public-launch device QA remains a P1 launch-hardening item.

Evidence:

- KITCH-F024 written visual/accessibility notes are now backed by Phase 9 simulator screenshot evidence from `docs/sessions/2026-04-26-bestchef-phase-9-qa-gates-release-readiness.md`.
- Public-launch device coverage is still pending for small iPhone, large iPhone, iPad if supported, small Android, large Android, dark mode, large text, reduced motion, poor network, offline, legal link surfaces, and first-run states.

Required work:

- Keep the completed Kitchen Intelligence Phase 9 screenshots in release evidence.
- Capture remaining public-launch screenshots for submit flow, social feed, dish detail, profile, settings, legal link surfaces, report menu, first-run, and account lifecycle flows.
- Cover small iPhone, large iPhone, iPad if supported, small Android, large Android, dark mode, large text, reduced motion, poor network, offline, and first-run states.
- Test VoiceOver and TalkBack labels, focus order, modal dismissal, dynamic type, reduced motion, touch target size, and route transition clarity.
- Store screenshots in the agreed evidence location, not as oversized generated docs artifacts.

Acceptance criteria:

- KITCH-F024 screenshot evidence is complete.
- Critical flows have no overlapping text, blank media slots, inaccessible icon-only controls, or dead interactions.
- Visual defects are filed or fixed before public beta.

Verification:

- `pnpm --filter @mylife/bestchef-app test:uiux`
- Manual screenshot checklist.
- VoiceOver/TalkBack pass.
- Reduced-motion pass.

### BCPROD-P1-02: Observability, Incident Response, and Support Readiness

Status: Not started

Required work:

- Choose privacy-safe crash reporting and logging approach, or document why public launch will operate without third-party analytics.
- Add production dashboards for auth failures, provider failures, upload failures, moderation backlog, report volume, Supabase errors, Edge Function latency, storage usage, and cost.
- Add incident severity levels, on-call owner, escalation path, rollback path, user communication template, and post-incident review template.
- Add support inbox, help center, known-issues page, and customer support macros.

Acceptance criteria:

- Launch team can detect auth, media, provider, moderation, and Supabase incidents without relying on user complaints.
- Support can triage account, content, upload, nutrition, provider, privacy, and deletion requests.
- Incident runbook exists and has owner signoff.

Verification:

- Synthetic incident drill.
- Support ticket drill.
- Dashboard screenshot or export in release evidence.

### BCPROD-P1-03: Rate Limits, Quotas, Anti-Spam, and Abuse Automation

Status: Not started

Required work:

- Add per-user and per-IP limits for auth, profile updates, submissions, media upload, comments, votes, follows, reports, provider calls, and product contribution writes.
- Add backoff and user-facing copy for rate-limited actions.
- Add detection for duplicate uploads, duplicate comments, vote floods, report floods, and provider-key abuse if any beta BYO path remains.

Acceptance criteria:

- Abuse attempts fail closed without blocking normal usage.
- Rate-limit responses are observable and user-readable.
- Moderator queue is protected from report spam.

Verification:

- Load/abuse fixture tests.
- Supabase/Edge Function limit tests.
- Manual rate-limit QA.

### BCPROD-P1-04: Data Lifecycle, Backup, Restore, Export, and Retention

Status: Not started

Required work:

- Define retention rules for local kitchen data, OCR text, receipt photos, product evidence photos, submissions, comments, votes, reports, moderation logs, provider traces, and deleted-account records.
- Configure Supabase backups and verify restore.
- Add user export path if required by policy.
- Add deletion propagation and audit report for local, cloud, storage, cache, and provider-derived data.

Acceptance criteria:

- Backup and restore drill is documented and passed.
- Delete-account and data export behavior match published policy.
- Private receipt/payment data retention is minimized and documented.

Verification:

- Backup restore drill.
- Delete-account drill.
- Export drill.
- Retention policy review.

### BCPROD-P1-05: Nutrition Completeness, Source Editing, and Health Claim Controls

Status: Incomplete

Evidence:

- `memory.md` lists remaining gaps for universal nutrition source editing and added-sugar schema storage.

Required work:

- Add source editing and correction path for nutrition data.
- Add added-sugar storage and display if the product is making Nutrition Facts-style claims.
- Add conflict review for USDA, Open Food Facts, GS1, local, and manual sources.
- Add warnings for missing serving size, missing unit conversion, ambiguous barcode, stale source, and low confidence.
- Add final nutrition disclaimer copy.

Acceptance criteria:

- Users can see and correct the selected nutrition source where appropriate.
- Missing data and source conflicts are visible and do not imply false precision.
- Nutrition claims are legally reviewed.

Verification:

- `modules/bestchef/src/db/__tests__/nutrition.test.ts`
- `modules/bestchef/src/nutrition/__tests__/recipe-nutrition.test.ts`
- Manual nutrition panel QA.
- Legal copy review.

### BCPROD-P1-06: Localization and Launch Locale Policy

Status: Incomplete

Required work:

- Decide launch locales.
- Replace English fallback legal, report, privacy, terms, UGC, provider, and nutrition strings in all launch locales.
- Validate RTL layout if Arabic or Hebrew remain enabled.
- Validate App Store screenshots and metadata per launch locale.

Acceptance criteria:

- Every enabled launch locale has reviewed legal and safety copy.
- Non-reviewed locales are disabled or clearly marked as beta according to product policy.
- RTL surfaces do not overlap or break interactions.

Verification:

- Locale catalog scan.
- Manual screenshots per launch locale.
- Legal/product localization signoff.

### BCPROD-P1-07: Android Public Release Readiness

Status: Not started

Required work:

- Decide whether Android launches with iOS or later.
- Configure Google Play listing, data safety, content rating, signing, internal testing, closed testing, screenshots, support URLs, and review notes.
- Run Android device QA for camera, media library, microphone, storage, offline retry, auth, and route transitions.

Acceptance criteria:

- Google Play Console release checklist is complete, or Android is explicitly out of launch scope.
- Android production build installs and passes smoke tests.

Verification:

- EAS Android production build.
- Google Play internal testing install.
- Android manual QA checklist.

### BCPROD-P1-08: Open Food Facts, USDA, GS1, and Product Contribution Operations

Status: Partial schema foundation, launch operations incomplete

Evidence:

- `docs/sessions/2026-04-25-bestchef-kitch-f019-f021-cloud-cache-sync-policy.md:57` says Open Food Facts export is workflow status only.

Required work:

- Confirm Open Food Facts API write policy, authentication, image consent, User-Agent, attribution, ODbL obligations, and rate limits.
- Confirm USDA FoodData Central key usage and attribution policy.
- Confirm GS1 subscription, API add-on, endpoint, terms, and launch permission.
- Build upstream export jobs only after legal/product approval.
- Add operator review before upstream writes.

Acceptance criteria:

- No upstream writes happen without explicit legal/product approval.
- Product contribution records separate BestChef moderation from upstream export status.
- Attribution and source labels are visible to users.

Verification:

- Provider policy approval artifacts.
- Upstream export dry run.
- Operator review QA.

### BCPROD-P1-09: Creator Monetization, Tips, Subscriptions, and Affiliate Controls

Status: Out of public launch unless explicitly scoped

Evidence:

- `docs/sessions/2026-04-24-bestchef-server-blockers-core-hub.md:45` lists service-owned payment/creator monetization Edge Functions as remaining work.

Required work:

- Decide whether tips, subscriptions, affiliate orders, or creator payouts are in launch scope.
- If in scope, implement payment provider integration, tax/compliance, creator onboarding, fraud controls, chargeback handling, support policy, payout reporting, and store policy review.
- If out of scope, hide or route every monetization CTA to `/soon` with no purchase path.

Acceptance criteria:

- No unfinished money movement surface is reachable in public launch.
- Any enabled money movement path has provider, legal, tax, support, and fraud approval.

Verification:

- Static route/CTA scan.
- Store policy review.
- Payment provider sandbox drill if scoped.

## P2 Post-Launch and Growth Work

These items should not block a controlled public beta if P0 is complete and P1 risks are signed off, but they should be tracked before growth.

- Discovery scale: search ranking, feed personalization, leaderboard quality, challenge integrity, spam-resistant trending, and cold-start content.
- Community operations: moderator analytics, trust tiers, contributor reputation, transparent action history, creator verification, and policy education.
- Marketing launch: website, press kit, app screenshots, launch calendar, creator outreach, waitlist/import funnel, lifecycle emails, and app review prompts.
- Support content: help center for auth, deletion, uploads, OCR, nutrition data, source corrections, reporting, privacy, and provider errors.
- Data quality: duplicate product merge tools, ingredient normalization, barcode conflict resolution, and source freshness jobs.
- Advanced kitchen intelligence: automatic meal planning, pantry depletion suggestions, grocery price intelligence, dietary constraints, allergen guardrails, and family/workspace sharing.
- Mesh sync completion: production social relay/native CRDT completion and cross-device kitchen sync beyond current private caps.

## Testing and Verification Matrix

| Area | Required checks | Evidence to capture |
|------|-----------------|--------------------|
| App UIUX contract | `pnpm --filter @mylife/bestchef-app test:uiux` | Passing output with test count. Failures must include file and line references. |
| Standalone app tests | `pnpm --filter @mylife/bestchef-app test` | Passing output with test count. |
| Standalone typecheck | `pnpm --filter @mylife/bestchef-app typecheck` | Passing output. |
| Module tests | `pnpm --filter @mylife/bestchef test` | Passing output with file and test count. |
| Parity | `pnpm check:parity --quiet` | Passing output. Existing warnings must be reviewed and accepted. |
| Function logic gate | `pnpm gate:function:changed` whenever source function logic changes | Passing output, or a documented reason it was not applicable for docs-only work. |
| Production export | `pnpm --filter @mylife/bestchef-app build` | iOS and Android export output, or release-specific EAS build evidence. |
| Dependency audit | `pnpm audit --prod --audit-level moderate` | Passing output or approved remediation/override. |
| Supabase migrations | Supabase migration status, staging migration, production migration, RLS tests | Migration ids, linked project refs, test outputs, rollback notes. |
| Storage and Edge Functions | Upload, download, signed URL, moderation, delete, retry, rate limit, provider broker tests | Function logs, storage object records, queue status, public URL privacy checks. |
| Manual device QA | iOS small/large, Android small/large, iPad if supported, first-run, offline, poor network, reinstall | Checklist, screenshots, defects, device/OS versions. |
| Accessibility QA | VoiceOver, TalkBack, dynamic type, reduced motion, touch targets, modal focus, route transition clarity | Checklist and screenshots. |
| Security/privacy QA | No service keys in app, no private media URIs in cloud, receipt/payment redaction, provider retention, RLS role tests | Static scan, fixture tests, database inspection. |
| Performance QA | Cold start, route transition, photo capture, upload time, video playback, DB migration time, memory during camera flows | Device measurements and thresholds. |
| Store readiness | App Store Connect metadata, privacy labels, age rating, export compliance, TestFlight notes, Google Play data safety if scoped | Store screenshots, review notes, signoff. |
| Support and operations | Support inbox, deletion request drill, moderation triage drill, incident drill, backup/restore drill | Runbook links, timestamps, owners, drill results. |

## Required Manual QA Flows

Every flow must be tested on a release candidate build, not only in local Expo development.

- First run: install, launch, permissions, default profile, onboarding copy, settings, privacy/terms links.
- Auth: anonymous beta migration, durable login, sign out if supported, reinstall restore, account deletion.
- Kitchen local: create recipe, edit recipe, add steps, favorite, Grocery flag, add to grocery list, delete recipe.
- Grocery: create list, duplicate list, add custom item, import recipe ingredients, check items, archive/restore list, copy checked items to pantry.
- Pantry: add item, edit item, use-one action, expiration filter, use-next filter, batch/lot review, delete item.
- Receipt OCR: capture clear receipt, noisy receipt, partial receipt, ambiguous receipt, sensitive payment receipt, non-food receipt, provider outage, cancellation, edit/merge review, pantry import.
- Grocery photo: capture clear groceries, noisy image, partial image, ambiguous candidates, non-food image, provider outage, cancellation, per-candidate source selection, confirmation-gated pantry mutation.
- Expiration OCR: capture clear date, ambiguous date, partial date, provider outage, cancellation, batch update confirmation.
- Nutrition panel: USDA/Open Food Facts/GS1/local/manual conflicts, missing data, unit conversion warning, stale data, manual correction, disclaimer visibility.
- Social public: feed, dish detail, chef profile, submit recipe, comment, vote, follow, report, block/mute if implemented, moderation status visibility.
- Media: upload photo, upload video, retry failed upload, offline media behavior, public approval, rejected media, delete-account cleanup.
- Settings: privacy, terms, support, data deletion, wipe local account, language switch, reduced motion, accessibility settings.

## External Launch Checklist

### Apple App Store

- Confirm bundle id, display name, category, age rating, export compliance, privacy URL, support URL, marketing URL, app review contact, demo account if needed, and Sign in with Apple if applicable.
- Complete App Privacy labels from the actual data inventory.
- Upload iPhone screenshots for required device classes and iPad screenshots if supported.
- Confirm camera, microphone, photo library, location, notifications, and background behavior descriptions match app behavior.
- Submit TestFlight release notes and production review notes.

### Google Play

- Decide whether Android public launch is in scope.
- Complete package name, signing, listing, screenshots, content rating, data safety, privacy policy, support contact, closed testing, and production rollout plan.

### Supabase and Cloud Ops

- Separate staging and production projects.
- Apply and verify migrations.
- Configure auth providers, anonymous policy if still used, storage buckets, Edge Functions, secrets, RLS, backups, logs, rate limits, and alerting.
- Run backup/restore drill.
- Record project refs, migration ids, and rollback plan.

### Provider and Data Source Operations

- AI/OCR provider: data processing terms, retention, model/provider choice, cost budget, redaction, rate limits, and outage process.
- USDA: data.gov key, usage policy, attribution, and cache policy.
- Open Food Facts: User-Agent, attribution, image consent, ODbL obligations, write approval, and rate limits.
- GS1: subscription, API add-on, endpoint, credentials, terms, attribution, and legal approval.

### Legal, Policy, and Support

- Privacy Policy.
- Terms of Service.
- Community Guidelines.
- UGC and moderation policy.
- Report and appeal policy.
- Data deletion instructions.
- Nutrition and medical disclaimer.
- AI/OCR provider disclosure.
- Copyright/content rights policy.
- Support inbox and help center.

### Release Operations

- Release owner assigned.
- Go/no-go meeting scheduled.
- Release branch frozen.
- EAS build ids captured.
- Supabase production state captured.
- Known issues documented.
- Rollback criteria documented.
- Post-launch monitoring window staffed.

## Current Verification Snapshot

The 2026-04-25 readiness review reported this local evidence:

- `pnpm --filter @mylife/bestchef-app build` passed, with iOS and Android export generated.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 16 tests.
- `pnpm --filter @mylife/bestchef-app test` passed, 47 tests.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 46 files and 686 tests.
- `pnpm check:parity --quiet` passed with existing standalone-missing warnings.
- `pnpm audit --prod --audit-level moderate` passed with no known production vulnerabilities.

This evidence supports internal beta only. It does not close the public production blockers above.

## Decision Table

| Decision | Current answer | Reason |
|----------|----------------|--------|
| Internal beta/TestFlight dogfood | Yes, with caveats | Local build and tests are green. Remaining issues can be caveated for trusted testers. |
| Public beta | No | P0 identity, demo content, media storage, legal, moderation, provider architecture, and release evidence are not closed. |
| Public GA | No | Requires P0 and P1 completion, external approvals, incident readiness, moderation staffing, and store compliance evidence. |

## Operating Rhythm

- Daily during beta hardening: review P0 board, failed checks, support/moderation findings, provider failures, and upload failures.
- Twice weekly until public beta: run the full command matrix and refresh release evidence.
- Before every release candidate: freeze branch, run full verification, capture device screenshots, run Supabase migration/RLS checks, run legal URL checks, and update known issues.
- Go/no-go meeting: Engineering, Product, QA, Legal, Support, Moderation, Cloud/Ops, and Release Owner must explicitly approve or block.
- Post-launch first 72 hours: staff monitoring for auth failures, upload failures, provider outage, reports, moderation queue age, crashes, support inbox, and App Store review feedback.

## Backlog Map

- Kitchen feature backlog: `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`
- Kitchen implementation record: `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`
- Codebase review: `docs/plans/features/recipes/bestchef-kitchen-intelligence-codebase-review.md`
- Server blockers log: `docs/sessions/2026-04-24-bestchef-server-blockers-core-hub.md`
- Production readiness/media hub log: `docs/sessions/2026-04-24-bestchef-production-readiness-media-hub.md`
- Product cache, contribution, and sync policy log: `docs/sessions/2026-04-25-bestchef-kitch-f019-f021-cloud-cache-sync-policy.md`
- QA expansion and fixtures log: `docs/sessions/2026-04-25-bestchef-kitch-f022-f024-qa-fixtures.md`

## Definition of Done for Public Beta

- All P0 items are closed with linked evidence.
- Any open P1 item has an explicit risk waiver with owner and expiry date.
- Full verification matrix is green on the release branch.
- Manual QA evidence exists for all required surfaces.
- Legal/support/moderation/runbook artifacts are published and linked.
- Store metadata and privacy forms match actual implementation.
- Supabase production is migrated, backed up, monitored, rate-limited, and rollback-ready.
- Release owner signs the go/no-go decision.
