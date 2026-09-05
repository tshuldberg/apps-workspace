# DoWork Plan 36 Wave 3: Phases 3 + 4 UI (2026-07-04)

Continuation of plan 36 (`docs/plans/queue/36-dowork-trainer-platform-launch.md`) from the
2026-07-03 handoff. Worktree `.claude/worktrees/dowork-trainer-launch`, branch
`feature/dowork-trainer-launch` (unpushed, now 15 commits).

## What was done

Two parallel `module-dev` agents with disjoint file zones (per the handoff protocol),
followed by an orchestrator adversarial review and a hardening commit.

### Commit `8d5092e2` (Phase 3, agent phase3-trainers-ui)

Trainer platform UI: `(tabs)/trainers.tsx` 6th tab (verified+active directory, search,
featured hero, invite footer, no fake/demo trainers), `trainer/[handle].tsx` public
profile (free/premium split rendered honestly under RLS, Subscribe CTA opens an honest
"not yet purchasable" modal until Phase 5, "Work with me" links to /client-invite),
`studio.tsx` (gated on own dw_trainers row; upload queue with expo-image-picker
multi-select + serial uploads + retry + expo-video-thumbnails; manage grid with view
counts, hide/delete/set-primary; profile editor incl. hero upload reusing the
trainer_thumbnail kind; Clients nav card to /clients), `redeem-invite.tsx` calling the
dowork-redeem-invite edge function via new `cloud-invites.ts`, exercise detail trainer
rail via `listExerciseTrainerRail`. Extended cloud-trainers/cloud-trainer-videos/
cloud-media clients + tests; parity script Phase 3 section.

### Commit `24c7d1f8` (Phase 4, agent phase4-coaching-ui)

Coaching loop UI: `clients.tsx` roster (active/invited/ended, invite creation with
crypto-random 12-char A-Z2-9 codes, per-client form-check threads),
`InviteShareSheet` (QR of dowork://client-invite/CODE via react-native-qrcode-svg +
native share + clipboard), `client-invite/[code].tsx` deep-link target +
`client-invite/index.tsx` manual entry (both join through the security-definer
`dw_redeem_client_invite` RPC only), `my-trainer.tsx` (entitled library via client
link, send form check, own thread), `form-check/[id].tsx` review screen (inline signed
playback via getPlaybackSource with expiry refresh, feedback anchored to timestamps
with tap-to-seek, attach-current-timestamp composer, video replies that insert
dw_form_feedback with reply_storage_path rather than finalize, trainer post flips
reviewed), offline text-feedback queue wired into pending-queues, Settings coaching
section + Home "your trainer" card. New `cloud-coaching.ts` (60 tests).

### Commit `b94a557b` (orchestrator review hardening)

Adversarial review of both commits (both approved). Findings fixed:

1. `generateInviteCode` silently fell back to `Math.random()` without Web Crypto.
   Now throws (fail-closed); callers surface an honest error. Regression test added.
2. `postFormFeedback` queued text feedback that failed local validation (body over
   the 1000-char cap), which would retry identically forever. Enqueue now skips
   validation failures; composer got `maxLength` wired to exported
   `MAX_FEEDBACK_BODY`. Regression test added.
3. Parity script gained the Phase 4 section: coaching routes/components, RPC-only
   join (fails if cloud-coaching ever selects by invite_code), service-role table
   avoidance, signed playback, QR deep link, settings/home wiring, QR dependency.
4. Cleanups: dead TRAINER_COLUMNS in dowork-redeem-invite fn, unused imports
   (UserPlus, React), two wave-introduced em dashes.

## Review checks that passed without findings

No service-role-only table reads (dw_trainer_invites / dw_purchase_events /
dw_video_view_marks); no client dw_trainers writes; protect-trigger fields never in
update payloads; directory filters is_verified AND is_active; dw_form_checks has
trainer-only update policy + column-protect trigger (status/reviewed_at only);
QR encodes the contracted deep link; Studio/profile cross-links match the zone
contracts; honest empty/gate/error states throughout.

## Verification

App suite 225/225 (was 104 pre-wave; +119 wave, +2 hardening), typecheck clean,
`check-dowork-parity` green (incl. new Phase 3+4 sections), edge suite 1213 passed,
staged function gate green on each commit.

## Phase 5 (same session): commit `b75f4a33` (agent phase5-monetization)

Monetization, reviewed and approved. `data/purchases.ts` is the sole
react-native-purchases importer (per-platform key with appl_/goog_ prefix
validation, honest unconfigured state, logIn with the Supabase user id,
trainer_id subscriber attribute set BEFORE purchase per the locked webhook
contract, tier -> dowork_trainer_tier_N mapping, cancel-aware purchase,
server-truth confirmation poll against dw_trainer_subscriptions with an honest
"confirming" pending outcome). `cloud-subscriptions.ts` reads own subscriptions
+ the dw_get_trainer_earnings RPC (never dw_purchase_events). Real PaywallSheet
replaces the Phase 3 placeholder (disclosure copy, terms/privacy links,
already-coaching state per founder decision 5, subscribed state); earnings.tsx in
Studio (monthly gross via RPC, store-cut honesty, split pending F4); Settings gains
Restore Purchases + Manage Subscription (OS deep links). +39 tests (app suite 264),
typecheck + parity green (new Phase 5 parity section). Sandbox matrix awaits F3.

## Phase 6 (same session): commits `f264e8a4` + `4b1347f7` + finalize `699e144e`

Two parallel agents, both reviewed and approved. Push half (`f264e8a4`): honest
Expo token lifecycle in data/push.ts (not_provisioned/denied/unsupported distinct
reasons, no fake tokens while projectId is the F2 placeholder), new
dw_notification_prefs migration (owner-only RLS) with SERVER-side per-type
enforcement in dowork-notify (missing row = defaults, marketing opt-in only via a
new manual founder-invoked broadcast type behind x-dowork-internal),
notification-preferences screen, NotificationRouter tap + cold-start routing,
dowork://video/[id] route, trainer QR poster share, deprecated Instagram icon
replaced, runbook gains push credentials + universal-links setup (associated
domains deliberately NOT stubbed in app.json). Downloads half (`4b1347f7`):
data/downloads.ts (server entitlement re-check at download AND open; definitive
403 not_entitled deletes honestly, transient/offline never punishes a legitimate
owner), player prefers the local file (no expiry refresh for local), settings
storage meter + wipe on sign-out, expo-av fully retired (upload-video migrated to
expo-video, wk_trainers local mirror + exercise-detail carousel removed, dep
dropped), day-1 truth + a11y pass over the wave 3-5 screens, CLAUDE.md refresh,
parity Phase 6 downloads section. Finalize (`699e144e`): parity gains the push
half (including a NotificationRouter-mounted check so tap routing can never
silently die) and the dead TRANSACTIONAL_TYPES const was removed. Final counts:
app 312, edge 1220, typecheck + parity green.

## Phase 7 code-side (same session): commit `88fad9af` (orchestrator)

eas-build-pre-install env guard at apps/dowork/scripts/check-build-env.mjs
(Manhattan pattern, 10 tests): production builds fail closed without the
per-platform RevenueCat key (dead paywall) or the Supabase env (dead trainer
platform); rejects secret keys, prefix mismatches, and the staging-cloud
override; exercised live against an empty production env. Version stamping was
already covered by eas.json appVersionSource remote + production autoIncrement.
Tickets/app-review-notes.md drafts the App Review copy (invite-only rationale,
on-device speech justification, UGC/moderation summary) with the founder-ops
demo-credentials plan. Tickets/white-glove-qa-checklist.md is the 9-section
device QA script (trainer onboarding, gym voice session, two-device coaching
loop, sandbox purchase matrix, push prefs, downloads incl. revoke honesty, deep
links, account deletion, polish sweep). Parity gained the Phase 7 section.
Final session totals: app suite 322, edge 1220, typecheck + parity + full
check:parity green.

Plan 36 now has NO remaining codeable work. Everything left is founder-ops
F1-F8; code re-engages only for white-glove QA findings.

## Remaining

Phase 5 monetization (next session; F3 RevenueCat products gate sandbox QA), Phase 6
hardening, Phase 7 store ops + white-glove TestFlight. Founder-ops F1-F8 unchanged;
F1 (Supabase prod deploy) gates all live QA. Known follow-ups: `expo-av` still used by
upload-video.tsx (migrate then drop), listTrainerLibrary in cloud-coaching duplicates a
trainer-video listing shape (dedup candidate), lucide `Instagram` icon is deprecated
upstream (works fine).
