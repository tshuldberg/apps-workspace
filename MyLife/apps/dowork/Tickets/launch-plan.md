# DoWork launch plan

## Status as of 2026-07-11 (adversarial audit remediation complete)

An 8-zone adversarial production audit (report `docs/reports/REPORT-dowork-adversarial-production-audit-2026-07-11.md`, plan `docs/plans/done/46-dowork-production-readiness-remediation.md`) verdict was NO-GO (6/10). All code-addressable P0/P1/P2/P3 findings are now CLOSED and committed on `feature/dowork-production-readiness` (commits 9b0a1596, 770c4e46, 3bf222d0, 32c04d9e). Gates green: typecheck, 518 app tests, 556 workouts tests, dowork parity, 429 edge-fn tests.

Remaining before public launch are FOUNDER-OPS only (cannot be closed in code):
- **F1** live `supabase db push` + deploy all 6 functions via the new `apps/dowork/scripts/deploy-functions.sh` (which pins verify_jwt correctly, BK-1) + configure Database Webhooks (gates coaching push).
- **F2** ASC $4.99 paid app + real `ascAppId` in `eas.json` (LG-3). **F3** RevenueCat 8-product ladder + webhook secret + EAS keys.
- **F4** trainer revenue-split decision (earnings screen shows real payouts after this). **F5** host + counsel-review legal pages; confirm governing law + moderation SLA staffing (LG-5).
- **F6** APNs/FCM keys. **F7** TestFlight white-glove QA with the first trainer. **F8** app icon + splash art (LG-1).

Optional code nits deferred: friendly-error copy for the BK-4 report-target trigger exception; correct 3 stale "registered persist hook" header comments in cloud-likes/comments/coaching.

## Status as of 2026-04-28 (P0-P4 + parity scaffold complete)

P0 — App scaffolding · **done**
- `apps/dowork/{package,app,eas,metro,tsconfig}.json`, shims/crypto.js, app/_layout.tsx + index.tsx, .gitignore

P1 — Brand system · **done**
- `apps/dowork/app/(root)/theme/tokens.ts` — iron orange `#FF6B00` on matte black `#0B0B0E`
- `apps/dowork/app/(root)/providers/AppThemeProvider.tsx`
- Placeholder splash backgroundColor wired in app.json

P2 — Database + provider tree · **done**
- `apps/dowork/app/(root)/providers/DatabaseProvider.tsx` — opens `dowork.db`, runs `WORKOUTS_MODULE.migrations` (6 migrations, 18 tables)
- `apps/dowork/app/(root)/_layout.tsx` — provider tree

P3 — Cloud / Auth foundation · **done (scaffold)**
- 4 Supabase migrations under `supabase/migrations/20260428*_dowork_*.sql`
- `dowork-upload-finalize` and `dowork-delete-account` edge function stubs (Deno)
- `apps/dowork/app/(root)/data/launch-environment.ts` policy + `data/account.ts` helpers
- `apps/dowork/app/(root)/providers/DoWorkCloudProvider.tsx` (anonymous Supabase session, magic-link auth)
- `apps/dowork/app/(root)/auth-callback.tsx`
- `docs/runbooks/dowork-supabase-setup.md`

P4 — Tab nav + home screen · **done**
- 5 tabs (Home, Explore, Workouts, Progress, Profile) live with real data from `@mylife/workouts`
- `_screen-kit.tsx` shared layout primitives

P7 — QA scaffold · **done**
- `scripts/check-dowork-parity.mjs` — wired into root `pnpm check:parity`
- `apps/dowork/app/__tests__/smoke.test.ts` — 12 tests pass (brand + launch policy)

## Remaining work

> **Orchestration handoff:** the full P5 + P6 execution runbook lives at `apps/dowork/Tickets/P5-P6-orchestration-runbook.md`. It includes the exact source → target file map per batch, cross-cutting adaptation rules, gotchas hit during P0-P4, helper-copy list, stack-registration recipe, agent-team operating model, sequencing, and merge gates. The summary below is for status tracking; agents should read the runbook for execution detail.

### P5 — Port workout screens · **done**

All 36 stack screens + 3 kits + 4 helper files ported from `apps/mobile/app/(workouts)/` to `apps/dowork/app/(root)/`. All Stack.Screen entries registered in `(root)/_layout.tsx`. `hub_settings` table added to DoWork DB. `formatCompactNumber` added to `(tabs)/_screen-kit.tsx`.

**Foundation pre-work (Batch 0, must land first):** copy `phase2-kit`, `phase3-kit`, `social-kit`, plus `lib/workouts/{settings,social,phase3}.ts` and `lib/uuid.ts` into DoWork.

Batches (PR-sized, each 200-1500 lines):

- [x] **Batch A — Workout flow** (8 screens)
  - `builder.tsx`, `session.tsx`, `exercises.tsx`, `exercise/[id].tsx`, `save-workout.tsx`, `superset.tsx`, `timer.tsx`, `warmup.tsx`
- [x] **Batch B — Programs/plans** (6 screens)
  - `programs.tsx`, `program/[id].tsx`, `program/create.tsx`, `program/new.tsx`, `plans.tsx`, `onboarding.tsx`
- [x] **Batch C — Tools/calculators** (4 screens)
  - `one-rm.tsx`, `plate-loader.tsx`, `calculator.tsx`, `main-exercises.tsx`
- [x] **Batch D — Tracking/analytics** (5 screens)
  - `history.tsx`, `photos.tsx`, `measurements.tsx`, `recordings.tsx`, `monthly-report.tsx`
- [x] **Batch E — AI/recovery** (5 screens)
  - `ai-workout.tsx`, `generate.tsx`, `recovery.tsx`, `body-map.tsx`, `overload.tsx`
- [x] **Batch F — GPS/Watch** (2 screens)
  - `gps.tsx`, `watch.tsx`
- [x] **Batch G — Insights** (1 screen, stripped)
  - `insights.tsx` — strip `detectMoodLiftCorrelation`, `detectFastingPerformance`, `detectProteinRecovery`; keep workout-internal detectors only
- [x] **Batch H — Social/Share** (5 screens, cloud-backed)
  - `social.tsx`, `social-feed.tsx`, `share.tsx`, `share-workout.tsx`, `upload-video.tsx`

Adaptation rules per batch (apply consistently):
1. Replace `from '../../components/DatabaseProvider'` → `from '../providers/DatabaseProvider'`
2. Replace `from '../../lib/workouts/...'` → `from '../../lib/workouts/...'` (DoWork's own)
3. Drop `ModuleLayoutWrapper` / `ModuleLockGuard` / `ModuleErrorBoundary` (hub concerns)
4. Drop hub cross-module imports (`@mylife/mood`, `@mylife/nutrition`, `@mylife/fast`)
5. Re-skin `WK_ACCENT` → DoWork accent in branded surfaces
6. Adapt to camelCase `WorkoutSession` rather than the `progress.ts` snake-case path; full row-format conversion is a P5 polish item

### P6 — Cloud-backed social/share (gates Batch H) · **done (code-side)**

Detailed function signatures, BestChef mirror references, and offline-queue patterns are in `P5-P6-orchestration-runbook.md` §5.

- [x] `apps/dowork/app/(root)/data/cloud-shares.ts` — `uploadWorkoutShare`, `listPublicShares`, `listFollowingShares`, `listMyShares`, `deleteShare`, `hideShare`
- [x] `apps/dowork/app/(root)/data/cloud-likes.ts` — `likeShare`, `unlikeShare`, `getLikeCounts`, `getMyLikedShareIds` (optimistic + offline queue)
- [x] `apps/dowork/app/(root)/data/cloud-comments.ts` — `postComment`, `listComments`, `deleteComment`, `editComment`
- [x] `apps/dowork/app/(root)/data/cloud-trainer-videos.ts` — upload + list + delete + set-primary against `dw_trainer_videos`
- [x] `apps/dowork/app/(root)/data/public-render-policy.ts` (ported from BestChef, env names swapped)
- [x] Function-gate tests scaffolded for each helper (33 new tests, 45 total passing)
- [ ] Wire Supabase project (real provisioning per `docs/runbooks/dowork-supabase-setup.md`) — user-side, blocks public launch but not code merges

### P7 — Security hardening · **done (2026-06-09)**

The June 9 production audit's 19 findings and P7-P12 roadmap were incorporated into `docs/plans/queue/36-dowork-trainer-platform-launch.md`; the superseded generated report was removed on 2026-07-09. P7 code landed:

- [x] `supabase/migrations/20260609000001_dowork_security_hardening.sql` — drops the `dw_trainers` FOR ALL owner policy (self-verification escalation, finding C1), splits owner policies per-operation with `is_verified = false` insert guard + protect trigger; explicit per-operation owner policies on `dw_workout_shares` and `dw_comments`; `dw_comment_rate_limit_ok` (5/min) enforced on comment inserts
- [x] `supabase/migrations/20260609000002_dowork_storage_policies.sql` — creates `dowork-avatars` / `dowork-share-media` / `dowork-trainer-videos` buckets with size + MIME limits and owner-folder RLS (finding C2); trainer videos private (signed-URL playback only)
- [x] `apps/dowork/plugins/withSecurityHardening.js` + `withDataProtection.js` + `android-res/` ported from BestChef and registered in app.json (finding H2)
- [x] `ITSAppUsesNonExemptEncryption` → `false` (finding H4)
- [x] `app/__tests__/app-config.test.ts` security contract + parity script P7 checks
- Privacy manifest: matched to BestChef pattern (Expo-generated during prebuild; no manual `PrivacyInfo.xcprivacy`, BestChef shipped TestFlight build 24 this way)

Remaining P7-adjacent (lands with P8/P9 per the report): real edge function implementations, delete-account UI, report/block UI, profile creation.

### P8 — Cloud completion · **done (2026-06-09)**

Worked in severity order from the production report. All DoWork gates green after: 63/63 app tests, 67/67 edge function tests, typecheck, dowork parity (173 checks), full `check:parity`.

- [x] **C3** `dowork-upload-finalize` implemented for real (sign + finalize, BestChef store pattern, 10 tests): server-side `dw_trainer_videos` row writes make device-path leaks impossible; `data/cloud-media.ts` client (sign → `FileSystem.createUploadTask` with progress → finalize); `upload-video.tsx` streams to the bucket, mirrors the cloud trainer into local `wk_trainers`, caps raised to 10 min / 500 MB
- [x] **C4** `dowork-delete-account` implemented for real (FK-safe row cascade, per-bucket prefix cleanup, `auth.admin.deleteUser`, 6 tests) + destructive-confirm Delete Account flow in settings (calls function, signs out, wipes `dowork.db`)
- [x] **C5** report/block shipped: `20260609000003_dowork_user_blocks.sql`, `cloud-reports.ts` + `cloud-blocks.ts`, report/block action sheets on feed posts and comment threads, blocked authors filtered from feed, Blocked Users screen, support/guidelines/privacy links in settings
- [x] **C6** trainer gate is now the cloud `dw_trainers` row (`cloud-trainers.ts`); triple-tap myth deleted; honest invite-only and cloud-off copy
- [x] **H1** `dw_user_profiles` created at first session (`cloud-profiles.ts` ensureUserProfile, deterministic `lifter_xxxxxx` handle + collision retry, 8 tests); provider exposes `profile` + `trainerProfile`; feed and post screens resolve author identity via `dw_public_profiles`
- [x] **H3** all four offline queues (shares, likes, comments, feedback) persist to `hub_settings` KV (`pending-queues.ts`, restore + round-trip + cold-restart tests); hydrate at provider init, and persist at enqueue time and after every flush retention update via a registered per-queue persist hook (CG-2 / IMP-8), plus flush on session ready + app foreground and a persist on background. Enqueue-time persistence means an op composed offline survives a force-quit that never routes through the background handler; the hook is best-effort and never breaks the user-facing op.
- [x] **H5** cloud shares are the primary production feed content with real authors; fixture feed stays dev-only behind `shouldShowDemoContent`
- [x] **M1** comments wired: new `post/[id]` thread screen (list, optimistic composer, report/block on comments) reachable from every feed card
- [x] **M4** Toolbox grid on Progress tab fronts 9 finished orphan screens (history, insights, monthly report, photos, measurements, recordings, calculators, overload, top exercises)
- [x] **M5** Watch entry removed from settings; "Filters Coming Soon" pill deleted

### Plan 36 (trainer platform launch, supersedes the P9-P12 sequencing above)

- [x] Phase 1 cloud spine: schema v2 (8 dw_ tables, 4-path entitlement, earnings RPC) + all 6 edge functions (`3a238830`, `57f4fbb4`, security fix `1a1e6baf`)
- [x] Phase 2 voice-controlled player: expo-video signed playback + on-device VoiceCoach (`fa6b8cfd`, engine `91ff8f7c`)
- [x] Phase 3 trainer platform UI: Trainers tab + directory, trainer/[handle] profile, Studio (bulk upload queue, manage grid + view counts, profile editor), redeem-invite onboarding, exercise trainer rail (`8d5092e2`, 2026-07-04)
- [x] Phase 4 coaching loop UI: clients roster + QR invites, client-invite deep-link join via dw_redeem_client_invite RPC, my-trainer, form-check/[id] timestamped review + video replies, offline text-feedback queue (`24c7d1f8`; review hardening `b94a557b`, 2026-07-04)
- [x] Phase 5 monetization: react-native-purchases wrapper (per-platform key validation, trainer_id subscriber attribute set pre-purchase per the locked webhook contract, server-truth confirmation poll), real PaywallSheet replacing the placeholder (honest unconfigured + already-coaching states, terms/privacy links), Studio earnings screen off the dw_get_trainer_earnings RPC, Restore/Manage in Settings (`b75f4a33`, 2026-07-04; sandbox matrix awaits F3)
- [x] Phase 6 launch hardening (`f264e8a4` push half + `4b1347f7` downloads half + `699e144e` review finalize, 2026-07-04): push end to end (honest token lifecycle, dw_notification_prefs migration + server-enforced per-type prefs in dowork-notify, opt-in-only marketing type, tap deep-link routing incl. cold start, dowork://video/[id]), trainer QR poster, offline downloads (server entitlement re-check at download + open, honest revoke deletion, offline plays local), settings storage meter + sign-out wipe, expo-av fully retired + wk_trainers local mirror removed, day-1 truth + a11y pass, CLAUDE.md refresh. Universal links documented in the runbook (needs live dowork.app, F2/F5)
- [~] Phase 7 code-side DONE 2026-07-04: eas-build-pre-install env guard (production fails without RC keys / Supabase env), `Tickets/app-review-notes.md` (review copy + demo-credentials plan), `Tickets/white-glove-qa-checklist.md` (9-section device QA script). Remaining Phase 7 is founder-heavy: F1-F8, seed demo accounts, run the checklist on device with the trainer, submit
- Audit remediation 2026-07-04: dp-audit-2026-07-04 (6.8/10, 22 findings) FULLY remediated in 6 wave commits `c988442d..16269fef` (auth callback/PKCE + reset-password, purchase-ledger anonymization, paid-through cancellation, active/verified trainer serving truth, ended-link read-only + honest offline queues, share identity guard, real Save/Discard via workouts v7, voice silence budget, GPS metrics, virtualization). NEW deploy gate: migrations `20260704000002` + `20260704000003` and redeploys of delete-account/playback-url/upload-finalize/rc-webhook must land before the next TestFlight build.
- Founder-ops status 2026-07-04: **F1 DONE + live-verified** (Supabase prod `tgyxkoblbiacjsbmiuyn`: 10 migrations, 6 functions ACTIVE, pg_net webhooks, secrets, auth config, full entitlement matrix verified); **F2 half done** (EAS project `1f78cafb-496c-48fd-9a38-2bda8cb24b56` + 5 production env vars; ASC app + ascAppId still founder); **F7 prep done** (demo trainer/subscriber/invite codes seeded through real pipelines, see app-review-notes.md); **F5 drafted** (`apps/dowork/legal/`, needs dowork.app hosting + counsel). Plus a QA fix: account screen with password sign-in (`2aa6b935`), since the app had no sign-in surface and App Review needs password creds. REMAINING: F2-ASC, F3 RevenueCat (8 products + webhook w/ keychain secret + `EXPO_PUBLIC_DOWORK_RC_KEY_IOS/_ANDROID` into EAS env; build guard enforces), F4 split decision, F5 hosting, F6 APNs/FCM, F7 TestFlight + white-glove-qa-checklist.md with the trainer, F8 icon art.

### P12 — EAS + deployment (store ops)

User-side interactive steps:
- [ ] `pnpm dlx eas-cli init --id <projectId>` → fill `apps/dowork/app.json` `extra.eas.projectId`
- [ ] Apple Developer Portal: register `com.dowork.dowork` bundle id
- [ ] App Store Connect: create app ($4.99 paid tier), fill `apps/dowork/eas.json` `submit.production.ios.ascAppId`
- [ ] Google Play Console: create listing
- [ ] EAS env vars: see `docs/runbooks/dowork-supabase-setup.md`

Code work:
- [x] `apps/dowork/plugins/withSecurityHardening.js` (ported from BestChef, 2026-06-09)
- [x] `apps/dowork/plugins/withDataProtection.js` (ported from BestChef, 2026-06-09)
- [ ] `apps/dowork/plugins/android-res/` — adaptive icon resources (security XMLs landed 2026-06-09; icon art still pending)

### P9 — Documentation polish

- [ ] `apps/dowork/CLAUDE.md` (mirror `apps/bestchef/CLAUDE.md`) — initial version landed in this session
- [ ] `apps/dowork/README.md`
- [ ] Update `MyLife/CLAUDE.md` Apps section to mention DoWork
- [ ] Update workspace `Apps/CLAUDE.md` and `Apps/AGENTS.md` to include DoWork
- [ ] Open Brain capture once a real launch milestone lands

## Verification once P5+P6 complete

- [ ] `pnpm install && pnpm --filter @mylife/dowork-app typecheck && pnpm test`
- [ ] `pnpm check:parity` (DoWork parity included)
- [ ] `pnpm --filter @mylife/dowork-app dev` boots iOS sim + Android emulator without redbox
- [ ] `dowork.db` created with all 18 `wk_*` tables; `wk_exercises` count >= 50
- [ ] Anonymous Supabase session established on cold start
- [ ] Email magic link round-trips through `dowork://auth-callback`
- [ ] Create workout → session → log sets → complete → see in History
- [ ] Share to social feed visible to a second test account
- [ ] Hub `(workouts)` routes still load against `mylife-hub.db` (no regression)
- [ ] `eas build --platform ios --profile development` succeeds

## Bug tickets

(none yet)

## Feature tickets

(none yet — populate as launch QA reveals issues)
