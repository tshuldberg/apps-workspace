# DoWork Trainer Platform Launch: Session Log + Handoff (2026-07-03)

Handoff for the next session to continue plan 36 execution. Read this, then
`docs/plans/queue/36-dowork-trainer-platform-launch.md` (the plan is the single
source of truth; its "Execution contracts locked" section binds the next wave).

## Mission context

Trey's Dad's personal trainer is DoWork's first user. He has filmed workouts and will
film more, needs to upload his library, platform himself to get clients, run a private
coaching loop with each client (he films WITH clients and coaches form), and every
viewer controls playback hands-free by voice ("slow down", "back up") mid-workout.
Founder decisions locked (all four recommended paths accepted): DoWork standalone is
the app; hands-free continuous on-device voice while a video plays (toggle +
push-to-talk fallback); FULL coaching loop at launch; FULL monetization in the first
build. Everything ships at launch per the no-deferral mandate. Goal order: get the app
into the trainer's hands (TestFlight white-glove, plan Phase 7) as the build completes.

## Where things live

- **Worktree:** `.claude/worktrees/dowork-trainer-launch` (branch
  `feature/dowork-trainer-launch`, based on main `4ae6d19e`). NOT pushed.
  The main checkout holds a dirty Meerkat session (`feature/meerkat-launch-finish`);
  do not mix. `pnpm install` has been run in the worktree.
- **Plan:** `docs/plans/queue/36-dowork-trainer-platform-launch.md` (7 phases +
  founder-ops F1-F8 + locked execution contracts).
- **Audit that grounds everything:**
  `docs/reports/REPORT-dowork-production-readiness-2026-06-09.html` (19 findings,
  P7-P12 roadmap; P7+P8 landed 2026-06-09).
- **Ticket state:** `apps/dowork/Tickets/launch-plan.md` (P0-P8 rows current; P9+ rows
  not yet updated for plan 36; update as phases land).

## Commits on the branch (all gates green at each)

| Commit | What |
|---|---|
| `1bb510f9` | Plan 36 authored (473 lines) |
| `91ff8f7c` | Voice player engine in `@mylife/workouts`: `parsePlayerCommand`, `stepRate`, `PLAYER_RATE_LADDER`, `getSupportedPlayerCommands` + barrel exports. Word-boundary longest-phrase matching, spoken durations ("back up thirty seconds" -> -30), false-trigger guard (>6 words, no command in final 4). 66 new tests; module suite 532 green; typecheck clean |
| `3a238830` | Schema v2 migrations: 8 new dw_ tables, 17 policies, 5 security-definer helpers (`dw_redeem_client_invite`, `dw_get_trainer_earnings`, participant checks), 4-path entitlement policy on `dw_trainer_videos`, `dowork-form-checks` private bucket, parity script extended. Static SQL verification only; `db push` is founder-ops |
| `1a1e6baf` | SECURITY FIX from adversarial review: dropped `dw_trainers_owner_insert`. The Studio gate is dw_trainers ROW EXISTENCE, so the P7 guarded owner-insert let any user self-create an unverified trainer row and unlock trainer surfaces (C1-class escalation). Invite redemption (service role) is now the only creation path |
| `71907630` | Plan fix: earnings is the `dw_get_trainer_earnings()` RPC, not a view |
| `8b9667b9` | This handoff + execution contracts in plan 36 + memory/errors ledger updates |
| `766fcbba` | Player + voice deps installed (expo-video w/ PiP plugin, expo-speech-recognition w/ plugin + Android speech service package, expo-keep-awake, expo-screen-orientation, expo-video-thumbnails, expo-notifications) + iOS mic/speech permission strings in app.json |
| `57f4fbb4` | ALL 6 EDGE FUNCTIONS (wave 2a): dowork-redeem-invite (compensating delete), dowork-playback-url (4-path entitlement + view dedup + feedback-reply signing), dowork-rc-webhook (idempotent ledger, honest unmatched), dowork-notify (internal secret, 100-chunk Expo push, token pruning), upload-finalize upgrade (form_check kind + video metadata + best-effort notify), delete-account upgrade. 78 new vitest tests (suite 1213), parity extended + green, runbook updated. NOTE: edge fn suites run via `pnpm --filter @mylife/bestchef test` (its vitest globs include supabase/functions/**) |
| `fa6b8cfd` | VOICE-CONTROLLED PLAYER (wave 2b): player.tsx (signed URL + expiry refresh preserving position, resume via hub_settings, keep-awake, landscape-on-focus, rate ladder, PiP), useVoiceCoach + pure voice-coach-core (1.5 s debounce; forced on-device recognition; honest off/denied/listening/paused/unavailable), VoiceCoach pill + toasts, cloud-playback client, voice settings section. 41 new tests (app suite 104), typecheck + full function gate green. Orchestrator fixed 3 type errors on handback (readonly categoryOptions, isPictureInPictureSupported is a module-level expo-video export not a VideoView static, unused import) |

## Wave 2 LANDED (Phases 1 + 2 are code-complete)

Both wave-2 agents completed before the session wrap: all 6 edge functions
(`57f4fbb4`) and the voice-controlled player (`fa6b8cfd`). See the commit table.
The cloud spine and the marquee voice feature are done code-side; live behavior
still needs founder-ops F1 (nothing is deployed) and Phase 7 device QA.

## Next session starts here

1. **Phase 3: Trainer platform UI** (plan section, Trainers 6th tab + directory,
   `trainer/[handle]` profile, Trainer Studio with bulk upload queue +
   per-video metadata + view counts, `redeem-invite` onboarding screen, exercise
   detail trainer rail). Data clients extend `cloud-trainers.ts` /
   `cloud-trainer-videos.ts`, new `cloud-invites.ts`. Playback goes through the
   existing `player.tsx` route (`player?videoId=`).
2. **Phase 4: Coaching loop UI** (Clients section in Studio, client invite QR +
   `dw_redeem_client_invite` RPC join flow, form-check exchange over the
   `form_check` upload kind, `form-check/[id]` review screen with timestamped
   feedback anchored to the player, `player?formCheckId=` + `feedbackId` for
   replies). Phases 3 and 4 can run as parallel agents IF file zones are split
   (3: trainers tab/profile/studio/invites; 4: coaching screens + my-trainer);
   both touch Studio, so either sequence them or give Studio to one owner.
3. Then Phase 5 (RevenueCat; earnings screen calls the `dw_get_trainer_earnings`
   RPC; set RC subscriber attribute `trainer_id` at purchase), Phase 6 (push prefs,
   deep links + QR, offline downloads, day-1 truth pass, a11y, parity extension),
   Phase 7 (store ops + white-glove TestFlight with the trainer, including gym
   voice QA to tune the recognizer).

## Orchestration protocol that worked (keep it)

- Parallel `module-dev` agents with disjoint file zones; exactly one parity-script
  owner per wave; agents `git add` only their paths, retry on `index.lock`,
  Conventional Commits with the Claude co-author line, no em dashes.
- ADVERSARIALLY REVIEW every agent commit before building on it. The one real defect
  so far (owner-insert escalation) was committed by an agent with all gates green and
  only caught by review against the product model (invite-only). Check schema/RLS
  changes against WHO CAN CREATE WHAT, not just whether tests pass.
- Verification per wave: `pnpm --filter @mylife/workouts test` (532),
  `pnpm --filter @mylife/dowork-app test` (63), edge fn vitest suites,
  `node scripts/check-dowork-parity.mjs`, `pnpm check:parity`,
  `pnpm gate:function:changed`, package typechecks.

## Traps for the next worker

1. `modules/workouts/src/voice.ts` (old parser) and `src/voice/` (new dir) coexist;
   `from './voice'` resolves to the FILE. Player code imports the new engine from the
   `@mylife/workouts` barrel.
2. `dw_purchase_events` and `dw_video_view_marks` and `dw_trainer_invites` have RLS
   enabled with NO policies (service-role only). Client code must never select them;
   earnings go through the RPC.
3. The entitlement policy on `dw_trainer_videos` grants access to ACTIVE client links;
   client code should mirror those 4 paths but the server (playback fn + RLS) is the
   enforcement; never gate client-side only.
4. `expo-av` is deprecated but still used by `upload-video.tsx`; new playback is
   expo-video; migrate upload preview later, then drop expo-av.
5. The trainer directory (Phase 3) should filter `is_verified`; with owner-insert
   dropped all rows come from invites, but keep the filter as belt.
6. Simultaneous video playback + mic capture is the one real platform risk
   (iOS audio session). The contracts require honest `unavailable` state + push-to-talk
   fallback; real-device tuning happens in Phase 7 gym QA.
7. memory.md is over its 80-line budget repo-wide; do not bloat it further, archive
   if you touch it heavily.

## Founder-ops (Trey, start ASAP; F1 gates all live QA)

F1 Supabase prod project + `db push` (exercises schema v2) + deploy 6 functions +
verify 4 buckets + Database Webhooks (form_checks/form_feedback -> dowork-notify with
`x-dowork-internal`) + secrets (`RC_WEBHOOK_SECRET`, `DOWORK_INTERNAL_SECRET`).
F2 `eas init` + ASC paid app $4.99. F3 RevenueCat account + 8 products
`dowork_trainer_tier_1..8` + webhook. F4 revenue split decision with the trainer.
F5 legal pages at dowork.app. F6 APNs key + FCM. F7 TestFlight testers (the trainer +
1-2 clients). F8 icon/splash art.
