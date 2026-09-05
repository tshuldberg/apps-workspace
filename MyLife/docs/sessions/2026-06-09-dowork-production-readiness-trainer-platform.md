# 2026-06-09: DoWork production-readiness audit + trainer platform plan

## What was asked

Review DoWork's git history and determine everything required to reach production, with special focus on a trainer platform: the user has a trainer with many recorded videos who needs a full trainer UI (uploads, profile, platforming), and others should be able to become trainers too. Deliver a full comprehensive eval (features, security, everything) as an animated HTML document, with any new or changed screens rebuilt in HTML for visual reference.

## Scope decisions (locked via AskUserQuestion)

1. **Trainer access:** invite-only at launch (user's trainer first; self-serve waitlist later).
2. **Video infra:** Supabase Storage with signed upload + signed playback (no Mux/Cloudflare Stream at launch; revisit at ~1 TB/month egress).
3. **Monetization:** $4.99 paid-upfront app AND paid trainer subscriptions in v1, with trainers picking their own price from a fixed IAP tier ladder ($2.99-$49.99/mo, 8 auto-renewable products), RevenueCat purchase flow, webhook-driven `dw_trainer_subscriptions` + `dw_purchase_events` ledger, proposed 80/20 net split, manual monthly payouts at launch.
4. **Navigation:** dedicated Trainers tab (6th tab) plus embeds on exercise detail and the social feed.

## How the audit ran

Three parallel read-only audit agents plus a live test run:
- **Screens audit:** all 41 screens classified (29 FULL, 4 PARTIAL, 4 STUB/alias, 1 DEAD-END, 13 orphans unreachable by navigation; tab bar = Home/Explore/Workouts/Progress/Profile).
- **Security + launch infra audit:** RLS matrix for all 8 `dw_*` tables, edge function stubs, app.json/eas.json vs BestChef hardening, UGC compliance vs App Review Guideline 1.2.
- **Cloud wiring audit:** 21 cloud helper functions mapped to call sites (7 wired, 14 unwired), dual-feed architecture, offline queue mechanics, profile-creation gap.
- **Tests:** `pnpm test` in `apps/dowork`: 45/45 pass (12 smoke + 33 cloud helper, mock-level only).

## Key findings (19 total: 7 critical, 5 high, 5 medium, 2 low)

Critical:
1. `dw_trainers_owner_modify FOR ALL` lets any owner set `is_verified = true` (privilege escalation), `supabase/migrations/20260428000003_dowork_trainer_videos.sql:29`.
2. No storage buckets or `storage.objects` policies exist for any DoWork media (runbook names 3 buckets; nothing creates them).
3. `dowork-upload-finalize` returns 501; `upload-video.tsx:108` writes device-local `file://` paths into `dw_trainer_videos.storage_path`. No file ever uploads.
4. `dowork-delete-account` is a 501 stub and no UI calls `requestAccountDeletion()` (Apple 5.1.1(v), GDPR/CCPA).
5. Zero report/block/moderation UI despite scaffolded `dw_reports`/`dw_moderation_decisions` (guaranteed Guideline 1.2 rejection).
6. Trainer mode is unreachable: `getActiveTrainer()` requires `createTrainer()` which nothing in DoWork calls; the UI references a triple-tap gesture that does not exist in this app.
7. EAS `projectId` and ASC `ascAppId` are `REPLACE_WITH_*` placeholders; cannot build or submit.

High: `dw_user_profiles` never written (authorless shares); BestChef security plugins (`withSecurityHardening`, `withDataProtection`, android-res) missing; in-memory offline queues lose queued content on restart and nothing calls the flush functions; `ITSAppUsesNonExemptEncryption: true` is wrong (should be false); social feed renders local fixture data and never merges fetched cloud shares.

Medium/Low: comments engine fully built + tested but unwired; no rate limiting on comments/likes; missing PrivacyInfo.xcprivacy; 13 orphan screens; Watch stub + "Filters Coming Soon" copy; implicit delete policy on shares; empty `DOWORK_STAGING_PROJECT_REFS`.

## Trainer platform architecture (designed)

- Trainer identity = `dw_trainers` row created exclusively by new `dowork-redeem-invite` edge function (service role), killing both the C1 escalation and the dead local trainer mode.
- Schema v2: `dw_trainer_invites`, `dw_trainer_subscriptions`, `dw_purchase_events`, `dw_user_blocks`; `dw_trainers` + profile/pricing columns with protected-column trigger; `dw_trainer_videos` + title/description/is_premium/view_count with RLS premium gate (`!hidden AND (!is_premium OR owner OR active subscription)`).
- Five edge functions: upload-finalize (sign + finalize), redeem-invite, rc-webhook, playback-url (entitlement check + 60-min signed URL), delete-account (real cascade).
- Entitlement enforcement in three layers: RevenueCat CustomerInfo (UI), RLS on premium rows (database), private bucket + per-view signed URLs (media).
- Video caps raised from 30s picker limit to 10 min / 500 MB for trainer uploads; bulk multi-select upload queue with resumable `FileSystem.uploadAsync` and client-side thumbnails.

## Deliverable

`docs/reports/REPORT-dowork-production-readiness-2026-06-09.html`: self-contained animated HTML (DoWork iron-orange/matte-black theme, Plus Jakarta Sans) with hero verdict + count-up stats, 6-dimension scorecard rings (Core Training 88, Social 46, Trainer Platform 15, Security 38, Store Compliance 22, Overall 44), architecture flow diagrams with animated connectors, full findings ledger, RLS matrix, monetization design with revenue-split visualization, 12 phone-frame screen mockups (new: Trainers tab, trainer profile, paywall sheet, video player, Trainer Studio, bulk upload queue, invite onboarding, earnings; changed: exercise detail with cloud trainer rail, settings with compliance section, post detail with wired comments, report/block sheet), P7-P12 roadmap (26-35 working days, ~6 weeks), founder-vs-engineering launch checklist, risk register, and open questions (revenue split, tier values, payout rail, content licensing, iOS-first, annual SKUs).

Verified by loading in the headless browser at 1440x900: no console errors; hero counters, rings, galleries, and revenue split all render correctly (screenshots reviewed during the session).

## Files changed

- `docs/reports/REPORT-dowork-production-readiness-2026-06-09.html` (new, ~1,100 lines)
- `docs/sessions/2026-06-09-dowork-production-readiness-trainer-platform.md` (new, this file)
- `docs/archives/memory-sessions-2026-04-26-to-2026-05-12-bestchef.md` (new: archived 40 BestChef rows)
- `memory.md` (curated 143 → ~57 lines: collapsed ~45 duplicate stop-hook rows, archived BestChef block, updated DoWork project state + next-session notes, added session row)

## Verification

- `pnpm test` (apps/dowork): 45/45 pass.
- No function logic changed this session (audit + report only), so `pnpm gate:function:changed` was not required.
- Report rendered and screenshot-verified via headless browser.

## Remaining work

Execute roadmap P7-P12 per the report. Founder-side items to start immediately: Supabase staging/prod projects, `eas init` + bundle registration + ASC paid app, RevenueCat account + tier products, revenue split decision, trainer agreement, hosted legal pages, invite #1 to the trainer.

---

# Addendum (same day): Roadmap P7 security hardening executed

"Continue" directive after the report: P7 (the first roadmap phase) was implemented in full.

## What landed

1. **`supabase/migrations/20260609000001_dowork_security_hardening.sql`** (fixes C1 + audit-friendly policies + rate limit)
   - Drops `dw_trainers_owner_modify FOR ALL`; replaces with per-operation owner policies. Insert requires `is_verified = false`; a `BEFORE UPDATE` trigger (`dw_trainers_protect_verified`) blocks `is_verified` changes unless the caller is service role or admin SQL (`postgres`/`supabase_admin`), so dashboard moderation still works.
   - Adds `dw_trainers_owner_select` so owners can read their own row while `is_active = false`.
   - Splits `dw_workout_shares_owner_all` and `dw_comments_owner_modify` into explicit select/insert/update/delete owner policies.
   - `dw_comment_rate_limit_ok(uuid)` (SECURITY DEFINER, 5 comments/min) enforced inside the comment insert policy; execute granted to `authenticated` + `service_role` only.
2. **`supabase/migrations/20260609000002_dowork_storage_policies.sql`** (fixes C2)
   - Creates `dowork-avatars` (public, 5 MB images), `dowork-share-media` (public, 250 MB images/video), `dowork-trainer-videos` (private, 500 MB video) with `on conflict do update` so limits converge.
   - Owner-folder policies (`(storage.foldername(name))[1] = auth.uid()`) per BestChef's proven DO-block pattern; trainer videos have no public/anon select (playback via signed URLs from the planned `dowork-playback-url` function).
   - Deliberate divergence from BestChef: buckets are created in-migration rather than via dashboard, making provisioning deterministic.
3. **Plugins ported from BestChef** (fixes H2): `apps/dowork/plugins/withSecurityHardening.js` (no cleartext traffic, backup/device-transfer exclusion rules, strips Always-location strings; DoWork's when-in-use GPS strings are unaffected), `withDataProtection.js` (NSFileProtectionCompleteUntilFirstUserAuthentication, file sharing off), `android-res/` XMLs. Registered in `app.json`.
4. **`ITSAppUsesNonExemptEncryption` flipped to `false`** (fixes H4; matches BestChef's accepted App Store config).
5. **Privacy manifest decision:** matched to BestChef, which has no manual `PrivacyInfo.xcprivacy` and shipped TestFlight build 24 relying on Expo's prebuild-generated manifest. Report finding M3 is closed as "match proven pattern" rather than hand-authoring one.
6. **Tests + gates:** new `app/__tests__/app-config.test.ts` (6 tests: encryption flag, plugins registered + present, Android backup off, both migrations' key contents). Parity script gained a P7 section (artifact presence, policy-drop + bucket assertions, app.json encryption/plugin checks). Runbook storage + migration sections updated; launch-plan gained a P7 done section and P8 plugin items checked.

## Verification

- `pnpm test` (apps/dowork): 51/51 pass (was 45).
- `pnpm typecheck` (apps/dowork): clean.
- `node scripts/check-dowork-parity.mjs`: all checks pass including new P7 section.
- `pnpm check:parity --quiet`: full suite green.
- `pnpm gate:function:changed`: fails, but on the pre-existing documented blocker only: the parallel Manhattan session's uncommitted `packages/db/src/index.ts` change triggers the `@mylife/mobile` consumer typecheck, which fails on the known `(recipes)/comments.tsx` + `creator-apply.tsx` drift. No DoWork files involved. `errors_log.md` canonical row date updated to 2026-06-09.
- SQL caveat: no local Postgres (no psql, Docker down), so migrations are statically verified + content-asserted by tests; they run for real at `supabase db push` during provisioning.

## P7 items intentionally deferred to P8/P9 (per the report's phasing)

Real edge function implementations, delete-account UI, report/block UI, profile creation, feed merge, queue persistence.

---

# Addendum 2 (same day): Roadmap P8 cloud completion, worked in severity order

"Work through tasks in priority/severity order" directive: every remaining codeable critical, then the Highs, then the Mediums.

## Criticals closed

- **C3 real upload pipeline.** `supabase/functions/dowork-upload-finalize/index.ts` rewritten from 501 stub to a real two-action function (BestChef injected-store pattern, 10 vitest cases): `sign` validates kind caps/MIME/trainer status and returns an absolute signed Storage URL with a server-chosen `<user_id>/<dir>/<uuid>.<ext>` key; `finalize` verifies the object exists in the bucket and writes the `dw_trainer_videos` row server-side, making device-path leaks structurally impossible. Client: new `data/cloud-media.ts` (sign → `FileSystem.createUploadTask` streaming with progress → finalize). `upload-video.tsx` now actually uploads, shows percent progress, mirrors the cloud trainer into local `wk_trainers` for the on-device library, and raises caps to 10 min / 500 MB.
- **C4 real account deletion.** `dowork-delete-account` implements the full wipe (FK-safe row cascade including trainer children and both sides of blocks, per-bucket `<user_id>/` prefix object removal with bounded pagination, then `auth.admin.deleteUser`; 6 vitest cases). Settings gained the destructive-confirm Delete Account flow: edge call → sign-out → local `dowork.db` deletion.
- **C5 UGC report/block.** New migration `20260609000003_dowork_user_blocks.sql` (owner-only RLS, self-block check). New `data/cloud-reports.ts` (5 canned reasons incl. "Dangerous form advice") and `data/cloud-blocks.ts`. Feed post cards have a ⋯ menu (report with reason picker, block author); comment rows report/block on long-press; blocked authors filter out of the feed at load and immediately on block; Blocked Users management screen; Settings support section (help mailto, community guidelines, privacy policy links).
- **C6 trainer gate.** `data/cloud-trainers.ts` `getMyTrainerProfile`/`listActiveTrainers`; upload screen gates on the cloud `dw_trainers` row with honest invite-only and cloud-off copy. The unreachable triple-tap local trainer mode is gone.

## Highs and Mediums closed

- **H1 profiles.** `data/cloud-profiles.ts`: `ensureUserProfile` (deterministic `lifter_<uuid6>` handle, random retry on collision, parallel-device race re-read; 8 tests), `getPublicProfiles`, `updateMyProfile`. `DoWorkCloudProvider` ensures the profile after every session and exposes `profile` + `trainerProfile` + `refreshIdentity` in context. Settings shows the real @handle.
- **H3 queue persistence.** `restorePending*Queue` seams added to all three cloud helpers; new `data/pending-queues.ts` serializes queues into `hub_settings` (`dowork.pending_cloud_ops.v1`), hydrates at provider init, flushes on session ready and app foreground, persists on background (4 tests incl. corrupt-payload and like-flip dedupe).
- **H5 feed identity.** Cloud shares render with author avatar/name/handle resolved via `dw_public_profiles`; fixture feed remains dev-only behind `shouldShowDemoContent`.
- **M1 comments.** New `post/[id].tsx` thread screen: share card with like toggle, comment list with author identities, optimistic composer (500-char cap), report/block on both the post and individual comments. Reached from every feed card's comment count.
- **M4 Toolbox.** Progress tab gained a 9-tile Toolbox grid fronting the finished orphan screens (calendar history, insights, monthly report, photos, measurements, recordings, calculators, overload, top exercises).
- **M5 honesty.** Watch row removed from Settings; "Filters Coming Soon" pill deleted from the feed header.

## Files

New: `supabase/migrations/20260609000003_dowork_user_blocks.sql`, `data/cloud-media.ts`, `data/cloud-trainers.ts`, `data/cloud-profiles.ts`, `data/cloud-blocks.ts`, `data/cloud-reports.ts`, `data/pending-queues.ts`, `post/[id].tsx`, `blocked-users.tsx`, function tests x2, app tests x2 (`cloud-profiles.test.ts`, `pending-queues.test.ts`).
Rewritten/edited: both edge functions, `upload-video.tsx`, `settings.tsx`, `social-feed.tsx`, `progress.tsx`, `DoWorkCloudProvider.tsx`, `(root)/_layout.tsx`, `cloud-shares.ts` (+`getShareById`, restore seam), `cloud-likes.ts` + `cloud-comments.ts` (restore seams), `cloud-trainer-videos.ts` (exported row mapper), `scripts/check-dowork-parity.mjs` (P8 artifacts + routes), `Tickets/launch-plan.md` (P8 done section; EAS section renumbered P12).

## Verification

`pnpm test` (dowork): 63/63. Edge functions via `vitest --root supabase/functions`: 67/67 (all BestChef suites still green). `pnpm typecheck`: clean. `node scripts/check-dowork-parity.mjs`: 173 checks pass. `pnpm check:parity --quiet`: full suite green. Repo-wide `gate:function:changed` remains blocked by the pre-existing host mobile Recipes drift (errors_log row already updated this session); DoWork-scoped gates all pass.

## Remaining

Roadmap P9 (trainer platform core: invites, Trainers tab, Studio, player, premium RLS), P10 (monetization), P11 remainder (hosted legal pages are founder-side; report/block UI is done), P12 (store ops). Founder items unchanged: Supabase provisioning (`supabase db push` exercises all three 20260609 migrations), `eas init`, ASC paid app, RevenueCat.
