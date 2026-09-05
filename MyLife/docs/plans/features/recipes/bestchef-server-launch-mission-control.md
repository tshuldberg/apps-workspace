# BestChef Server Launch Mission Control

Date: 2026-04-27

Status: Server launch mission control. Public beta and GA remain blocked.

## Status Delta (2026-07-03, adversarial production review)

This ledger went stale between 2026-04-27 and the June work. The July 3 and July 5 reviews are
retained in git history; the current code-and-hosted-state audit is
`docs/reports/REPORT-bestchef-production-launch-gate-2026-07-09.html`, and the forward
plan is `docs/plans/queue/33-bestchef-global-launch-7-languages.md` (plan 33).

Now true (supersedes rows below):
- P0-05 provider broker is REAL and WIRED, not a scaffold: `_shared/broker.ts` durable `bc_consume_provider_quota` ledger + dual kill switch + anon per-minute caps + 50k global daily cap, fail-closed, called by all three provider functions (Wave 1 `2e5d6951`, migration `20260529000005`).
- P0-02: a production project ref exists (`zjxabnazbdocrqpyixgo`, hardcoded in `launch-environment.ts` and targeted by `scripts/deploy-functions.sh`); the committed `.env.local` still points at staging. Dashboard state remains unverified from the repo (founder-ops F1 in plan 33).
- P0-06/F-045/F-046/F-047: cloud dish catalog, discover, and video feed query `bc_*` tables (Wave 1). Scheduled jobs migration `20260610000001` adds hourly rankings + 15-minute deletion worker gated on `bc_job_config`.
- PR #11 (`022f5f84`) shipped legal constants, AI consent, data export, server-backed blocks, terms acceptance, privacy manifest.
- i18n catalog parity is now gate-enforced (root `check:i18n-parity` in the `check:parity` chain + scoped pre-commit leg, 2026-07-03) with all 21 catalogs at 807/807.

Still true (unchanged below): P0-04 app upload queue missing; P0-08 legal corpus unpublished (URLs are dead placeholders); P0-09 observability/rate limits/backups Not started; P0-10 release evidence Not started; all deployment evidence pending.

New operational traps found (fix per plan 33 Phases 0-1):
- `bestchef-delete-account` and `moderate_vote_proof` are invoked with a worker secret and NO user JWT and must be deployed `--no-verify-jwt`. `scripts/deploy-functions.sh` (PR #11) already encodes the split; `config.toml` now mirrors it declaratively (2026-07-03) so non-script deploy paths keep the invariant.
- Missing `bc_job_config` rows make the deletion worker a silent no-op forever; absent pg_cron/pg_net silently unschedules both jobs. A job-health surface is required.
- 2 of 8 storage buckets are PUBLIC by migration backfill (`bc-avatars`, `bestchef-submission-images`); needs a documented decision or signed-URL migration.
- Vote-proof moderation auto-approves via stub classifiers; proof-hash dedup is per-submission; `bc_delete_vote` allows unthrottled delete+revote.

Verdict: Build the public launch around a standard server-backed architecture. Do not use local-only device communication, LAN peer sync, BLE, WebRTC, or mesh relay as the launch-critical path for BestChef.

Scope: Standalone BestChef Expo app, `@mylife/bestchef`, Supabase Auth, Postgres/RLS, Storage, Edge Functions, server jobs, public data policy, moderation, provider broker, legal URLs, observability, release evidence, App Store and Play Store readiness.

Canonical rule: BestChef standalone remains the canonical product surface. Durable business logic belongs in `modules/bestchef`; the standalone app owns Expo Router UI and thin adapters. Server launch behavior belongs in Supabase migrations, Edge Functions, typed module cloud helpers, and app providers.

## Launch Architecture Decision

BestChef public launch uses this standard server path:

- Supabase Auth for durable identity, email recovery, Apple Sign-In, optional Google, anonymous beta upgrade, and account deletion.
- Supabase Postgres with RLS for public social data, private account-owned data, moderation state, seed provenance, reports, audit events, provider usage, and account lifecycle.
- Supabase Storage for submission media, thumbnails, product evidence, receipt evidence, quarantine, and deletion cleanup.
- Supabase Edge Functions or equivalent server functions for signed uploads, provider broker calls, moderation actions, seed import, account deletion, rate limiting, and background cleanup.
- Local SQLite only for offline drafts, local caches, optimistic UI, retry queues, and device-local kitchen state before explicit upload.

Non-goals for public launch:

- No local-only device communication as the public launch data path.
- No LAN, nearby peer, BLE, WebRTC, or mesh relay dependency for account restore, social posting, comments, votes, media delivery, moderation, provider calls, or account deletion.
- No client-owned provider API keys in public launch builds.
- No `file://` media in public cloud rows or public deltas.

## Current Baseline

Already implemented:

- Internal beta cloud bridge and anonymous Supabase bootstrap.
- Account lifecycle SQL foundation: `supabase/migrations/20260426000007_bestchef_account_lifecycle.sql`.
- Typed account lifecycle helpers in `modules/bestchef/src/cloud/account-lifecycle.ts`.
- Settings account UI for email linking, recovery email, and cloud-aware delete-account flow.
- Local/cloud delete-account orchestration and local media wipe.
- Public data policy guard that blocks demo cloud alias writes by default in production or public-launch builds.
- Account lifecycle runbook and public data policy runbook.
- Kitchen Intelligence Phase 9 simulator screenshot evidence.
- BestChef module/app typechecks, tests, UIUX guard, parity, and changed-function gate passed during the 2026-04-26 session.
- Vote Proof-of-Cook BCVOTE-P0 server schema and RPCs landed locally on 2026-04-27 with pgTAP coverage for reject paths, happy path, moderation approval/rejection, delete cascade, and active-only scoring.
- Vote Proof-of-Cook BCVOTE-P1 local draft/cache schema and typed helpers landed locally on 2026-04-27 with module/app tests, UIUX guard, parity, generated-artifact check, and changed-function gate coverage.
- Vote Proof-of-Cook BCVOTE-P2 capture UX landed locally on 2026-04-27 with a full-screen CookProof vote flow, approved-proof gallery/profile surfaces, UIUX contract coverage, and required app/module/gate checks.
- Vote Proof-of-Cook BCVOTE-P3 moderation worker landed locally on 2026-04-27 with a server-only `moderate_vote_proof` Edge Function, stubbed classifier interfaces, decision RPC integration, face-blur metadata path, focused function tests, and recompute helper documentation.
- Vote Proof-of-Cook BCVOTE-P4 landed locally on 2026-04-27 with submission gallery count/view-all behavior, focused proof linking, profile 3-up My Cooks grid, authenticated `bc_delete_vote` UI with confirmation, server-side deleted/private media marking, and pgTAP account-deletion proof cascade coverage.
- Vote Proof-of-Cook BCVOTE-P5 documentation/local verification landed locally on 2026-04-27. Staging/production deployment evidence remains blocked until Supabase production credentials, Edge Function deploys, Storage buckets, and device QA access are available.

Known repo-level artifact status:

- `pnpm check:generated-artifacts` passed on 2026-04-27. The earlier investor PDF blocker is no longer active under the current artifact guard.

## Launch Gates

| Gate | Decision | Required state |
|------|----------|----------------|
| Internal beta | Allowed with caveats | Anonymous beta auth, local/provider caveats, and current green checks remain acceptable for trusted testers. |
| Public beta | Blocked | All P0 server launch tracks are closed or explicitly signed off by engineering, product, legal, support, and moderation. |
| General availability | Blocked | P0 and P1 are closed, production monitoring/support/moderation/legal/store readiness is complete, and release evidence is signed. |

## P0 Workstreams

### BCVOTE-PROOF: Vote Proof-of-Cook Launch Blocker

Spec: `docs/plans/features/recipes/bestchef-vote-proof-of-cook.md`.

Product rule: every public vote on a recipe submission requires a voter-owned completed plated dish photo before the vote is committed. This applies to `gold`, `silver`, `bronze`, and `like`. Approved proofs are public by default on the submission gallery and voter profile. The launch path is server-backed only.

| Phase | Status | Evidence |
|-------|--------|----------|
| BCVOTE-P0: Server schema + RPC | Complete locally | `supabase/migrations/20260427000008_bc_vote_proofs.sql`, schema mirror, `supabase/tests/bc_vote_proofs.sql`, and module schema contract coverage. Local Supabase migration applied and pgTAP passed with 37 tests. |
| BCVOTE-P1: Local schema + draft store + helpers | Complete locally | Local schema v18 adds `rc_local_vote_proofs`, device-local sync cap coverage, `modules/bestchef/src/social/vote-proof.ts`, `modules/bestchef/src/cloud/vote-proof.ts`, and `vote_proof` media upload intent support with a 2 MB cap. Full module/app gates and changed-function gate passed on rerun. |
| BCVOTE-P2: Capture UX | Complete locally | Added `/submission/[id]/vote`, `CookProofCapture`, `CookProofGallery`, recipe vote navigation, submission gallery reads, profile "My Cooks", camera/library proof selection, upload/pending/offline/error states, accessibility labels, reduced-motion gallery behavior, and UIUX contract coverage. |
| BCVOTE-P3: Moderation Edge Function | Complete locally | Added server-only `supabase/functions/moderate_vote_proof`, worker-secret auth, NSFW and food-likeness classifier interfaces with local stubs, optional face-blur metadata recording, provider-outage fail-closed behavior, and `bc_apply_vote_proof_decision` RPC integration. |
| BCVOTE-P4: Profile + submission integration + deletion | Complete locally | Added submission CookProof total count with `View all (N)`, focused proof inclusion for profile/gallery taps, profile 3-up My Cooks grid, owner-only delete controls with confirmation, authenticated `deleteVoteWithProof`/`bc_delete_vote`, and pgTAP account-deletion cascade/media-inventory coverage. |
| BCVOTE-P5: Verification + docs | Complete locally, deployment evidence pending | Updated public-data/account lifecycle policy docs, recorded P4/P5 evidence, and ran local gates. Staging/production walkthroughs, deployed functions, hosted Storage buckets, and iOS/Android device QA remain external launch evidence blockers. |

P0 details:

- `bc_vote_proofs` is RPC-only for inserts. Voters can read their own pending proofs, public readers can read approved proofs, and moderator/admin roles can read all.
- `bc_votes` now has `status` values `active`, `proof_pending`, `proof_rejected`, and `deleted`. Public scoring counts only `active` votes.
- `bc_cast_vote(p_submission_id uuid, p_tier text, p_media_asset_id uuid)` rejects unauthenticated calls, missing profiles, missing submissions, invalid tiers, invalid proof assets, self-votes, duplicate votes, and duplicate proof hashes.
- Proof assets must be uploaded image media owned by the voter with `owner_kind = 'vote_proof'` and a content hash.
- `bc_apply_vote_proof_decision` is service/admin-only and promotes approved proof media to public or rejects the proof and vote.
- `bc_submit_vote` now raises a proof-required error and is revoked from public client roles.

P1 details:

- Local schema v18 adds `rc_local_vote_proofs` as an offline draft/cache table only. It stores local image URI and hash for recovery, expires drafts after seven days, and is capped to `device_local` in the BestChef sync policy with sensitive draft columns stripped.
- `prepareProof` strips JPEG EXIF segments, computes SHA-256 on the processed bytes, enforces the 2 MB proof limit, and accepts a platform image processor hook for Expo compression before upload wiring lands in P2.
- `castVoteWithProof` wraps `bc_cast_vote(p_submission_id, p_tier, p_media_asset_id)` and maps RPC reject codes into typed client results for P2 UI states.
- `drainPendingProofs` retries `draft`, `uploading`, and `committing` local rows, honors the seven-day TTL, and uses injected upload/cast operations so the Expo capture flow can supply byte upload wiring without putting service-role behavior in the bundle.
- `createVoteProofMediaAsset` and `completeVoteProofUpload` call the existing server Edge Functions for signed upload and finalize. The shared media policy now accepts `owner_kind = 'vote_proof'` and caps these uploads at 2 MB.

P2 details:

- Recipe detail voting no longer writes local syncable votes or calls the old vote RPC. Every tier routes through `/submission/[id]/vote` with `gold`, `silver`, `bronze`, or `like`.
- `CookProofCapture` shows the required public-photo notice before submit, camera/library controls, preview, tier selection, and the five required states: empty, loading, error, success, and partial.
- The vote route re-encodes the image as JPEG through Expo image manipulation, reads bytes locally, calls `prepareProof`, creates a server media upload intent, uploads to the signed Storage URL, finalizes the upload, and calls `castVoteWithProof`.
- If cloud readiness, alias resolution, upload, or retryable vote commit fails, the route queues `rc_local_vote_proofs` as an offline draft instead of writing any public `bc_*` row with a `file://` URI.
- Submission detail reads the 12 most recent approved CookProofs for the cloud submission when available. Profile reads the current voter's approved proofs under "My Cooks".
- `CookProofGallery` is reduced-motion aware and all new interactive controls have accessibility labels.
- Future alt text remains reserved for a later schema column. No alt text column was added in P2.

P3 details:

- `moderate_vote_proof` is server-only and requires `BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET` or `BESTCHEF_MODERATION_WORKER_SECRET`. The Expo app never receives service-role credentials.
- The worker consumes `bc_moderation_queue` items with `kind = 'vote_proof'`, loads the pending proof and linked media asset, obtains a moderation image URL from Supabase Storage, and runs NSFW plus food-likeness classifier interfaces.
- Local development uses stub providers behind the same interfaces. Live provider credentials are still a deployment TODO and must be configured only in Supabase/server secret storage.
- High NSFW scores and low food-likeness scores call `bc_apply_vote_proof_decision(..., 'rejected', reason)`. Safe food proofs call the same RPC with `approved`.
- Provider outage marks the queue failed but leaves `bc_vote_proofs.status = 'pending'`; it never auto-approves.
- Face detection/blur is optional in MVP. The worker records face-blur metadata when the provider reports `blurred`, `recommended`, or `not_needed`.
- There is no hosted nightly cron configured in this repo. Manual recompute helper exists as `bc_rebuild_rankings(p_dish_id uuid default null)`; TODO before staging launch: configure a Supabase cron or scheduled job to call it after moderation decisions.

P4 details:

- Submission detail now reads approved proof totals and shows the 12 most recent proofs by default, with `View all (N)` expansion.
- Profile `My Cooks` now uses a 3-up approved-proof grid. Proof taps route to the submission detail with `proofId`; submission loading includes the focused proof first and highlights it.
- Owner delete controls appear only for the current profile's proofs. The Expo app calls the authenticated `bc_delete_vote(p_submission_id uuid)` RPC and never receives service-role credentials.
- `bc_delete_vote` removes the linked vote/proof rows and marks the linked proof media row `upload_status='deleted'`, `moderation_status='rejected'`, and `visibility='private'` while preserving Storage refs and metadata for server cleanup.
- Local pgTAP coverage now verifies vote deletion, media privacy/deleted marking, account-deletion vote/proof cascade, and account-deletion worker media inventory. The local database required `supabase migration up --local` before the new deletion-media assertions passed.
- Remaining worker hook: there is still no dedicated hosted vote-deletion Storage purge worker in this repo. The current account-deletion worker purges owned media, and vote deletion marks proof media for a future server-side purge job keyed by `metadata.storage_purge = 'pending_server_worker'`.

P5 details:

- Public data policy now documents vote-proof public fields, non-public states, and deletion behavior.
- Account lifecycle docs now call out vote proof rows and media in account deletion.
- Verification is local-only in this repository session. Staging/production deployment, hosted worker secrets, Storage bucket inspection, iOS/Android walkthroughs, and web read-only QA still need release evidence after credentials and devices are available.

Remaining blocker: public voting stays launch-blocked until BCVOTE deployment evidence, production Supabase environment setup, hosted Storage/functions/workers, moderation provider credentials, and device QA are complete.

### BCSERVER-P0-00: Launch Architecture Freeze

Priority: P0

Owner: Engineering, Product

Status: In progress. Server source-of-truth boundaries and launch sync guard are documented and partially enforced. Public launch remains blocked.

Evidence:

- `docs/runbooks/bestchef-server-source-of-truth-runbook.md` documents server-owned source-of-truth boundaries for auth, restore, submissions, comments, votes, media, moderation, provider calls, and deletion.
- Static audit on 2026-04-26 found BestChef mesh usage in `apps/bestchef/app/(root)/providers/DatabaseProvider.tsx` and `apps/bestchef/app/(root)/data/local-submissions.ts`; public-launch builds now disable BestChef mesh sync startup through `shouldEnableBestChefMeshSync`.
- `apps/bestchef/app/(root)/data/launch-environment.ts` treats public or production builds as non-mesh launch paths and rejects staging Supabase config for public builds unless explicitly marked as internal-only.
- `apps/bestchef/app/(root)/data/__tests__/launch-environment.test.ts` covers the public-launch mesh disable and staging cloud guard.

Required work:

- Treat this server-backed launch decision as binding for all public launch work.
- Remove or feature-flag any public launch dependency on local-only device communication.
- Audit launch-critical flows for hidden reliance on `packages/sync`, `sync_change_log`, local aliases, or device peer state.
- Document which local SQLite tables are cache/draft only and which server rows are source of truth.

Acceptance criteria:

- Public launch flow diagram exists for auth, account restore, media upload, comments, votes, moderation, provider broker, and account deletion.
- Every public launch path has a server-owned source of truth.
- Local-only or mesh paths are explicitly marked internal/beta/non-launch.

Verification:

- Static scan for launch-critical imports from sync or peer transport code in BestChef public flows.
- Manual architecture review against this mission control.

### BCSERVER-P0-01: Production Auth, Account Linking, and Recovery

Priority: P0

Owner: Engineering, Product, Support

Status: Foundation in progress. Native callback/session handling is implemented locally, but public launch remains blocked on production auth provider setup and device verification.

Evidence:

- `apps/bestchef/app/(root)/data/auth-links.ts` parses native Supabase auth callbacks for PKCE `code`, implicit `access_token` and `refresh_token`, `token_hash`, recovery type, and provider errors.
- `apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx` subscribes to initial and runtime native URLs, completes Supabase auth sessions, refreshes the current user/profile, and exposes account callback status.
- `apps/bestchef/app/(root)/(tabs)/settings.tsx` displays account link or recovery callback state.
- `docs/runbooks/bestchef-account-lifecycle-runbook.md` now documents supported callback shapes and remaining device QA.
- `apps/bestchef/app/(root)/data/__tests__/auth-links.test.ts` and `auth-links.function-gate.test.ts` cover callback parsing and session completion helpers without external credentials.

Required work:

- Configure Supabase Auth for production: site URL, redirect URLs, email templates, recovery URLs, Apple Sign-In, and optional Google.
- Add native deep-link handling for magic links, recovery links, and provider callbacks.
- Finalize durable-account onboarding: anonymous beta upgrade, fresh durable sign-in, reinstall restore, sign-out, session refresh, and provider list rendering.
- Add typed integration tests or smoke scripts for anonymous, durable email, Apple, optional Google, recovery, and reinstall behavior.
- Verify RLS behavior for anonymous beta, durable authenticated user, moderator, admin, and unauthenticated public readers.
- Keep anonymous beta as internal-only or explicitly label it as beta.

Acceptance criteria:

- Fresh install can create or sign into a durable account.
- Anonymous beta user can link to durable auth without losing local recipes, submissions, votes, comments, media cache records, or kitchen data.
- Reinstall restores expected cloud profile state for durable users.
- Recovery link completes on device and returns the app to a valid session.
- Public launch build does not silently rely on unrecoverable anonymous-only identity.

Verification:

- iOS device smoke test.
- iOS simulator smoke test.
- Android emulator smoke test if Android public beta is in scope.
- Supabase Auth dashboard configuration capture.
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm --filter @mylife/bestchef test`

External dependencies:

- Apple Developer Sign in with Apple configuration.
- Supabase production project and Auth provider access.
- Email sender domain or approved Supabase email sender.

### BCSERVER-P0-02: Staging and Production Supabase Environment

Priority: P0

Owner: Engineering, Cloud/Ops

Status: Inventory started. Staging is linked and migrated through account lifecycle. Local Edge Function and Storage scaffolding now exists. Production launch environment is incomplete and currently blocked.

Evidence:

- `docs/runbooks/bestchef-supabase-environment-runbook.md` records the 2026-04-26 staging and production inventory.
- `supabase projects list` shows linked `BestChef Staging` ref `tcikvihyjetsfkjjpljv`; no separate BestChef production project was visible.
- `supabase db push` applied `20260426000007_bestchef_account_lifecycle.sql` to linked staging, and `supabase migration list` showed local and remote migrations matching through `20260426000007` at the time of inventory.
- `supabase/migrations/20260426000008_bestchef_account_deletion_worker.sql` is now staged locally to preserve deletion request audit rows after Auth user deletion. It still needs staging and production migration application.
- `supabase functions list` returned no deployed functions at inventory time. Local function scaffolding now exists for provider broker, account deletion, media upload, and media finalize.
- EAS `development`, `preview`, and `production` environments currently point to the staging Supabase URL and anon key. Public production remains blocked until production EAS env uses a production Supabase project.
- `supabase/config.toml` now includes `bestchef://auth-callback`, `bestchef:///auth-callback`, and `https://bestchef.app/auth/callback` in local redirect config, plus local BestChef media bucket definitions.

Required work:

- Confirm staging Supabase project ref, migration state, Auth config, Storage config, Edge Function deploy target, and env var wiring.
- Create or validate production Supabase project with separate URL, anon key, service role secret, database password, storage buckets, and auth providers.
- Separate development, preview, and production EAS env vars.
- Add environment guardrails so production launch builds cannot point to staging accidentally.
- Capture `supabase migration list`, deployed Edge Functions, Storage buckets, RLS policy checks, and Auth provider screenshots in release evidence.
- Add rollback plan for migrations and Edge Functions.

Acceptance criteria:

- Staging and production environments are separate and identifiable in app diagnostics.
- Public launch build uses production Supabase env vars.
- Service role secrets never enter Expo public env.
- Migration state and function deploy state are captured.
- Rollback procedure is documented and tested on staging.

Verification:

- `supabase projects list`
- `supabase link --project-ref <staging-ref>` and `supabase migration list`
- Production env var inventory review.
- EAS env inspection for development, preview, and production.
- App diagnostic screen or log capture showing expected project URL in non-sensitive form.

External dependencies:

- Supabase project owner access.
- EAS project owner access.

### BCSERVER-P0-03: Service-Role Account Deletion and Data Lifecycle

Priority: P0

Owner: Engineering, Support, Legal

Status: Local worker scaffold implemented. Public launch remains blocked until the worker is deployed, secrets are configured server-side, and a staging deletion drill passes.

Evidence:

- `supabase/migrations/20260426000008_bestchef_account_deletion_worker.sql` changes `bc_account_deletion_requests.user_id` to `on delete set null` so deletion requests survive Auth user deletion for support audit.
- `modules/bestchef/src/cloud/schema.sql` mirrors the deletion-request retention contract.
- `supabase/functions/bestchef-delete-account/index.ts` implements a server-only worker gated by `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET`, uses service-role Supabase REST calls, processes requested/failed rows, deletes owned storage objects, marks media rows deleted/private, deletes the Auth user, and records completed/failed status metadata.
- `supabase/functions/bestchef-delete-account/__tests__/index.test.ts` covers missing worker secret, invalid secret, targeted processing, idempotent list processing, storage failure fail-closed behavior, and not-found handling.

Required work:

- Apply `20260426000008_bestchef_account_deletion_worker.sql` to staging and production once production exists.
- Deploy `bestchef-delete-account` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET` configured only in Supabase/server secret storage.
- Run the worker against seeded staging accounts and capture request status, Auth user deletion, social/profile cascade, media row state, and Storage object deletion evidence.
- Extend deletion propagation for thumbnails, provider usage records, and future retained/non-retained private evidence as those tables/jobs land.
- Preserve only policy-approved legal, abuse, payment, or moderation records.
- Add support procedure for retrying failed deletions.

Acceptance criteria:

- User can request deletion from the app.
- Worker completes cloud deletion without requiring direct database access.
- Storage objects owned by the deleted profile are removed or quarantined according to policy.
- Request status moves through pending, processing, completed, or failed with audit trail.
- Support can verify completion from documented SQL or ops UI.

Verification:

- Staging deletion drill with a seeded account.
- Storage object inspection before and after deletion.
- RLS check after deletion.
- Idempotent retry test.
- Support runbook review.

### BCSERVER-P0-04: Media Upload, Storage, Moderation, and Public Delivery

Priority: P0

Owner: Engineering, Cloud/Ops, Moderation

Status: Local server scaffold started. Public launch remains blocked until buckets/functions are deployed, app upload queue is wired, moderation/public-delivery approval is implemented, and device upload drills pass.

Evidence:

- `supabase/config.toml` defines local private buckets for submission images, submission videos, thumbnails, product evidence, receipt evidence, and quarantine.
- `supabase/functions/_shared/media.ts` validates owner kind, media kind, MIME type, size limits, no local/remote URL payloads, bucket selection, and Storage key construction.
- `supabase/functions/bestchef-media-upload/index.ts` creates a server-approved Storage key, signed upload URL, and pending `bc_media_assets` row with private visibility.
- `supabase/functions/bestchef-media-finalize/index.ts` marks a profile-owned pending asset as uploaded with dimensions/hash metadata while keeping moderation pending and visibility private.
- `supabase/functions/bestchef-media-upload/__tests__/index.test.ts` and `bestchef-media-finalize/__tests__/index.test.ts` cover auth rejection, URL rejection, bucket routing, size limits, profile ownership, and non-public finalize state.

Required work:

- Create hosted staging and production Storage buckets for submission images, submission videos, thumbnails, product evidence, receipt evidence, and quarantine.
- Deploy signed upload/finalize Edge Functions and configure server-only service-role secrets.
- Add quota enforcement, persistent rate limits, idempotent upload retry tokens, thumbnail generation, variant records, public URL approval/promotion, and moderation state transitions.
- Add app upload queue with compression, upload progress, retry, cancellation, and visible failure states.
- Ensure public feeds render only approved HTTPS media URLs.
- Add deletion propagation for account deletion and moderator takedown.

Acceptance criteria:

- Fresh user can upload a recipe photo and optional video through staging.
- Upload failure can retry without duplicate public submissions.
- Public cloud rows never contain `file://` URIs.
- Public feeds only expose approved media URLs.
- Delete-account removes media records and storage objects according to retention policy.

Verification:

- Device photo upload test.
- Device video upload test if video remains in public beta scope.
- Offline-to-online retry test.
- Public feed privacy test.
- Moderation approval/rejection test.
- Storage inspection.

### BCSERVER-P0-05: Server Provider Broker for OCR, AI, Nutrition, and Product Identity

Priority: P0

Owner: Engineering, Legal, Cloud/Ops

Status: Local provider broker scaffold implemented. Public launch remains blocked until functions are deployed with production credentials, persistent rate limits/usage logging exist, and provider/legal approvals are captured.

Evidence:

- `modules/bestchef/src/cloud/provider-broker.ts` provides typed broker clients for vision, nutrition, and product identity Edge Functions.
- `supabase/functions/bestchef-vision`, `bestchef-nutrition`, and `bestchef-product-identity` scaffold server-side provider calls with mocked tests and server-side env secret reads.
- Public-launch builds force the broker path and hide BYO provider key UI through `shouldUseBestChefProviderBroker()` and `shouldAllowBestChefByoProviderKeys()`.
- `apps/bestchef/app/(root)/data/__tests__/no-provider-urls.test.ts` scans app source for direct provider URL/key references.

Required work:

- Deploy provider broker functions to staging and production.
- Store provider credentials server-side only in Supabase/server secret storage.
- Add request redaction, especially receipt payment data and private images.
- Add rate limits, timeouts, retries, circuit breakers, provider status, cost budgets, and per-user quotas.
- Log provider usage with privacy-safe inputs and approved retention windows.
- Display source attribution, confidence, and uncertainty in user-facing nutrition/product output.

Acceptance criteria:

- No public launch user enters third-party provider keys in the app.
- Provider calls originate from the server broker or are disabled.
- Sensitive receipt/payment data is redacted before provider calls.
- Provider outage returns clear recovery UX without corrupting pantry/grocery state.
- Cost and failure rates are observable.

Verification:

- Production bundle scan for provider key input placeholders.
- Provider outage fixture test.
- Redaction fixture test.
- Edge Function integration test against mocked or sandbox provider.
- Legal/provider approval artifact.

### BCSERVER-P0-06: Public Data, Seed Content, and Social Source of Truth

Priority: P0

Owner: Product, Engineering, Legal

Status: Complete locally for the no-public-seed launch path. Editorial seed content remains fail-closed unless Product and Legal provide an approved seed revision and import evidence.

Evidence:

- `modules/bestchef/src/cloud/public-data-policy.ts` defines seed provenance, approval, rollback, render-decision, and public media URL helpers.
- `apps/bestchef/app/(root)/data/public-data-policy.ts` blocks demo cloud alias writes in production/public launch unless an approved seed revision is configured.
- `apps/bestchef/app/(root)/data/public-render-policy.ts` blocks public demo rendering unless an approved seed revision is configured.
- Public social surfaces now guard demo users, submissions, comments, votes, badges, challenge activity, leaderboard rows, and video feed entry points through `shouldShowDemoContent`.
- `supabase/migrations/20260427000010_bestchef_public_data_policy.sql` adds HTTPS-only `photo_url` constraints for `bc_dishes`, `bc_submissions`, and `bc_comments`.
- `apps/bestchef/app/(root)/data/__tests__/public-social-routes.test.ts` statically scans public social routes that import `DEMO_` content.
- `modules/bestchef/src/cloud/__tests__/public-data-policy.test.ts` covers unapproved seed suppression, approved editorial labeling, rollback blocking, and local URI rejection.

Required work:

- Launch seed strategy is fail-closed: no public seed content by default.
- If Product chooses editorial or partner seed content, add the server seed import job with source, rights, license, chef attribution, moderation state, media rights, approval revision, and rollback before enabling seed rendering.
- Keep public social data server authoritative for submissions, comments, votes, reports, follows, and profile display.
- Keep local-only IDs out of public server rows unless mapped to approved server records.

Acceptance criteria:

- No unlabeled fake users, fake submissions, fake votes, fake comments, or fake challenge activity render in public launch mode.
- Public seed records require rights, source, attribution, moderation state, approval revision, and rollback records before they can render.
- Production build blocks accidental demo cloud alias writes unless an approved seed revision is configured.
- Public `bc_dishes`, `bc_submissions`, and `bc_comments` `photo_url` values reject local device URIs at the database boundary.

Verification:

- Static scan for `DEMO_` imports in public social routes passed.
- Public-launch env guard tests passed.
- Seed approval, rollback, render-decision, and public media URL helper tests passed.
- Full BestChef app/module tests, UIUX tests, function gates, parity, and generated-artifact checks passed locally on 2026-04-27.
- Seed-enabled smoke test remains blocked until Product/Legal supply an approved seed revision and seed import evidence.

### BCSERVER-P0-07: Moderation, Reporting, Safety Ops, and Admin Surface

Priority: P0

Owner: Engineering, Moderation, Support, Product

Status: Complete locally for the minimum P0 SQL/function ops path. Full admin UI remains post-P0/P1 unless explicitly required for launch.

Required work:

- Added authenticated `bc_report_content` for submissions, comments, profiles, media assets, product contributions, product evidence, vote proofs, and legacy photo reports.
- Added admin/service `bc_apply_moderation_decision` for approve, reject, hide, remove, restore, and dismiss decisions.
- Extended `bc_moderation_decisions` with `previous_state` and `new_state` JSON audit fields and tied vote-proof moderation decisions into the same audit shape.
- Wired the visible BestChef report menu to call the cloud reporting path when cloud target IDs are available; public-launch builds fail closed instead of recording local-only reports.
- Documented launch abuse thresholds in module constants and the moderation ops runbook.

Remaining non-blocking or external work:

- Full moderator/admin UI with queue previews, target history, appeal notes, and support-safe evidence export.
- Staffing, SLAs, escalation paths, appeal windows, and support macros.
- Server/API-gateway rate-limit enforcement for public traffic scale.
- Account-level lock/mute/suspension actions beyond content/report audit.

Acceptance criteria:

- Minimum launch operator can triage and act through role-gated SQL/RPC without service-role secrets in the Expo bundle.
- Reported submission/comment content can be hidden from public surfaces while under review.
- Every decision records actor, target, reason, timestamp, previous state, and new state.
- Abuse thresholds are documented; infrastructure-level enforcement remains a launch ops TODO for scale.
- Support can inspect decisions from documented audit evidence, with full support UI still remaining.

Verification:

- `pnpm --filter @mylife/bestchef test -- moderation schema ranking-engine` passed locally on 2026-04-27.
- `pnpm --filter @mylife/bestchef typecheck` passed locally after mapper updates on 2026-04-27.
- `pnpm --filter @mylife/bestchef-app typecheck` passed locally after report-menu cloud wiring on 2026-04-27.
- `pnpm --filter @mylife/bestchef-app test` passed locally with 116/116 tests on 2026-04-27.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed locally with 27/27 tests on 2026-04-27.
- `pnpm --filter @mylife/bestchef test` passed locally with 787/787 tests on 2026-04-27.
- `supabase test db supabase/tests/bc_moderation_ops.sql --local` passed locally with 14/14 tests on 2026-04-27.
- `supabase test db supabase/tests/bc_vote_proofs.sql --local` passed locally with 44/44 tests on 2026-04-27.
- `pnpm gate:function:changed`, `pnpm check:parity --quiet`, and `pnpm check:generated-artifacts` passed locally on 2026-04-27.

### BCSERVER-P0-08: Legal URLs, Store Compliance, and Launch Copy

Priority: P0

Owner: Legal, Product, Support, Engineering

Status: Not started.

Required work:

- Publish final Privacy Policy, Terms, Data Deletion, Support, Community Guidelines, UGC Policy, Moderation Policy, Report/Appeal Policy, and nutrition/AI disclaimers.
- Wire all in-app legal/support links to production URLs.
- Complete Apple App Privacy labels and Google Play Data Safety forms if Android public beta is in scope.
- Confirm age rating, export compliance, account deletion compliance, content rights, and nutrition/health claim wording.
- Restrict launch locales or finish reviewed localized legal strings.

Acceptance criteria:

- All legal/support URLs return HTTP 200.
- In-app links open correct URLs on iOS and Android.
- Store metadata matches actual data collection, provider sharing, and retention.
- Legal signs off on nutrition, AI/OCR, UGC, content rights, and account deletion wording.

Verification:

- URL check.
- In-app link test.
- Store metadata checklist.
- Legal approval artifact.

### BCSERVER-P0-09: Observability, Rate Limits, Backups, and Incident Response

Priority: P0

Owner: Engineering, Cloud/Ops, Support

Status: Not started.

Required work:

- Add server logs and dashboards for auth failures, upload failures, provider failures, moderation actions, account deletion, RLS errors, Edge Function errors, and storage cleanup.
- Add rate limits to provider calls, media uploads, submissions, comments, votes, reports, and profile edits.
- Add backup/restore drill for Supabase database and Storage metadata.
- Add incident response runbook with severity levels, rollback, support messaging, and ownership.
- Add privacy-safe support export and diagnostic capture.

Acceptance criteria:

- Launch owner can see current health without querying production manually.
- Abuse and provider cost spikes are rate-limited.
- Backup restore drill passes on staging.
- Incident response runbook is linked from release packet.

Verification:

- Dashboard screenshot or log query evidence.
- Rate-limit fixture tests.
- Backup/restore drill evidence.
- Incident tabletop checklist.

### BCSERVER-P0-10: Release Branch, Evidence Packet, and Signoff

Priority: P0

Owner: Release Owner, Engineering, Product, QA, Legal, Support, Moderation

Status: Not started.

Required work:

- Freeze release branch after P0 work closes.
- Capture release evidence: git SHA, EAS build ids, Supabase project refs, migration state, Edge Function deploys, Storage buckets, legal URLs, store metadata, support/moderation runbooks, QA evidence, and known issues.
- Require dated written signoff from Engineering, Product, QA, Legal, Support, and Moderation.
- Define rollback criteria and post-launch monitoring window.

Acceptance criteria:

- Release packet exists and is complete.
- Every required command is green on the release branch, except explicitly waived known repo-level blockers.
- EAS production build maps to a git SHA and release notes.
- Supabase production state is captured.
- Approvals are explicit and dated.

Verification:

- Release branch check.
- Git SHA to EAS build mapping.
- TestFlight install and smoke test.
- Supabase migration/function/storage status capture.
- Signoff artifact review.

## P1 Public Beta Hardening

P1 work can run in parallel after P0 implementation starts, but must not hide P0 blockers.

- Device matrix QA on iPhone, iPad if supported, Android if in scope.
- Accessibility audit for Kitchen, upload, account, legal, reporting, and moderation-related screens.
- Public launch copy review and app screenshots.
- Localization restriction or reviewed launch locale pack.
- Support macros and response templates.
- Post-launch metrics dashboard for activation, upload success, provider failure, report volume, account deletion requests, and crash/error rates.

## Recommended Execution Order

1. BCSERVER-P0-00 architecture freeze and source-of-truth audit.
2. BCSERVER-P0-02 staging/production Supabase environment inventory.
3. BCSERVER-P0-01 auth, linking, recovery, and deep-link verification.
4. BCSERVER-P0-03 service-role account deletion worker.
5. BCSERVER-P0-04 media storage/upload/public delivery.
6. BCSERVER-P0-05 provider broker.
7. BCVOTE-P0 through BCVOTE-P5 proof-of-cook deployment, hosted worker wiring, and device QA evidence.
8. BCSERVER-P0-06 public data and social source of truth.
9. BCSERVER-P0-07 moderation/admin ops.
10. BCSERVER-P0-08 legal/store compliance.
11. BCSERVER-P0-09 observability/rate limits/backups.
12. BCSERVER-P0-10 release evidence and signoff.

## Verification Commands

Run as relevant for code changes:

```bash
pnpm --filter @mylife/bestchef-app typecheck
pnpm --filter @mylife/bestchef-app test
pnpm --filter @mylife/bestchef-app test:uiux
pnpm --filter @mylife/bestchef typecheck
pnpm --filter @mylife/bestchef test
pnpm gate:function:changed
pnpm check:parity --quiet
pnpm check:generated-artifacts
```

Notes:

- If only docs change and no function logic changes, state that the function gate was skipped because no source function logic changed.
- `pnpm check:generated-artifacts` passed on 2026-04-27 under the current artifact guard.
- For Supabase changes, also capture migration/function/storage status from staging and production.

## Launch-Blocking External Inputs

- Apple Developer Sign in with Apple configuration.
- Supabase production project owner access.
- EAS production env var access.
- Production domain and legal/support page publishing.
- Legal approval for Terms, Privacy, UGC, moderation, provider, nutrition, and AI/OCR disclaimers.
- Moderation/support staffing owner and escalation policy.
- Provider accounts and data-processing terms for AI/OCR, USDA, Open Food Facts, GS1, and any analytics/crash reporting.
