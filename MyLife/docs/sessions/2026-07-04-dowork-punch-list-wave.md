# DoWork punch-list wave (post-review fixes), 2026-07-04

Founder said "get working" on the 6.5/10 production-review punch list. Executed
as five parallel module-dev agents with strict disjoint file zones plus two
orchestrator commits; every agent commit was adversarially reviewed before
acceptance (one reviewer claim was itself disproven during review: the
reachability guard's pass on `social` turned out to be a legitimate inbound
from social-feed, not a guard hole).

## Commits (in order)

| Commit | Zone | What |
|---|---|---|
| `d08d9bcd` | orchestrator | friendly-error mapper + 7 tests (raw backend strings never reach users) |
| `efb5bc87` | C coaching | Studio error/gate separation (transport failure no longer shows the invite gate), form-check video error state w/ Retry + notice moved above composer + KeyboardAvoidingView/persistTaps via opt-in CoachingScreen prop, clients connection gate + isReady flash guard + End-coaching confirm |
| `1c4a58d4` | A queues | flush loop KILLED (snapshot-and-clear + non-enqueueing cores), comment duplication fixed, likes attempts-reset fixed, MAX_QUEUE_ATTEMPTS=5, clearAllPendingQueues on sign-out (cross-identity flush closed), flush mutex, sign-out order fixed (no more wipe-then-fail), honest "Saved offline" share UX w/ queued flag, fake Following segment removed, 34 zone tests |
| `3ad8fe7b` | B voice/player | recognition re-arms on OS 'end' via pure restart policy (400ms gap, >4-in-10s window gives up into honest 'interrupted' state, push-to-talk preserved, budget resets on toggle), false code comment fixed, player mid-playback failure now shows Retry+Back overlay preserving playhead; 8 policy tests |
| `57f12a90` | D trust | report/block on trainer profile + video long-press (profile/trainer_video kinds) + my-trainer rows, PushPrompt card (honest states, KV-persisted dismissal) at redeem-done/client-join/my-trainer, my-trainer partial failures surfaced w/ Retry, paywall price truth (store price only, loading/error states, no Subscribe without resolved price), stale comment + Work-with-me copy fixed; 12 tests |
| `b69ede12` | E wiring | wire-or-cut ALL orphans: Workouts tab Programs (programs/plans, revives Home UP NEXT) + Tools (timer/warmup/superset), Progress Toolbox +5 tiles (one-rm/generate/gps/recovery/body-map), Explore full-library entry, onboarding first-launch gate (Skip-safe), DELETED watch stub + upload-video/share (superseded) + 2 dead alias files, parity script gains a reachability guard (registered route with no inbound = FAIL, honest 5-route deep-link allowlist) |
| `7379253b` | orchestrator | attempts cap for the offline feedback queue (the one file no agent owned) + poison-drop test |
| `f6c1e62a` | F gps | REAL GPS: expo-location foreground-only position source behind a typed seam (fix mapping keeps null altitude/speed honest), pre-permission explainer + honest denied (Open Settings) / unavailable / error states, never fabricated movement, simulator __DEV__-only behind a visible SIMULATED badge, keep-awake while recording, app.json plugin + honest whenInUse copy, no background modes; 15 tests. Also surfaced the workspace Expo SDK 54/55 skew (errors_log row) |

## Verification (all six commits together)

- App suite: 375/375 tests, 26 files (after Punch F).
- `npx tsc --noEmit` clean.
- `node scripts/check-dowork-parity.mjs` green including the new reachability
  guard; full `pnpm check:parity` green (52 module layouts).
- Em-dash sweep: only pre-existing hits (P5-era comment + numeric placeholder
  glyphs on Home), nothing from this wave.

## Review-verdict deltas (from the 6.5/10 report)

Closed: all 3 Criticals (sign-in reachability was closed earlier at `e106c7e5`,
flush loop, voice restart), Studio misgate, form-check spinner + keyboard,
my-trainer silent partials, report/block gap, push-registration gap, raw error
strings on the touched surfaces, ~19 orphaned screens (wired or deleted),
Following fake semantics, paywall price truth, sign-out data-loss ordering,
watch stub, About dead row (settings, via A), first-launch onboarding.

Still open (known, deliberate): two-brand visual seam across the 16 ported
screens; near-zero a11y labels on the ported workout half; first-workout funnel
still builder-first (~8 interactions); trainer-platform reads do not filter by
block list (copy stays honest: "won't appear in your feed"); purchases.ts deep
`priceString ?? tier.label` fallback; paywall price shown only after store
resolution. Plus everything device-bound: icon/splash art (F8), RevenueCat
products + keys (F3), and the white-glove device QA that gates any 9/10 claim.

## E-wave deviations + follow-up (from the punch-e-wiring report)

- one-rm was WIRED, not cut as the review suggested: it is the sole writer of
  the 1RM PR history that exercise/[id] reads via getLatest1RM; cutting it
  would deaden that panel. Correct call under the full-function mandate.
- The onboarding gate lives in app/index.tsx reading dowork.db directly
  because (root)/(tabs) are route groups and a (root)/index.tsx would collide
  at "/". Any read error is treated as not-onboarded; onboarding has Skip and
  writes the flag, so it cannot trap.
- social.tsx was correctly KEPT (distinct profile screen reached from
  social-feed via /(root)/social?userId=), not a duplicate.
- FLAGGED: gps.tsx was a disclosed Simulator Mode recorder (no location
  package; fabricated movement, dev-facing alert copy). Wiring it into the
  Toolbox made an App Review 2.3.1 risk user-reachable in a paid app. Punch F
  dispatched same-session: real expo-location foreground tracking, honest
  permission/denied/unavailable states, simulator confined to __DEV__ behind a
  visible SIMULATED badge.

Punch F LANDED (`f6c1e62a`): GPS is real. Code-side readiness after this wave:
~8/10. The remaining gap to 9 is hardware truth (voice in a real gym, push end
to end, purchase sandbox, real-GPS on device) plus F3/F8, then the two-brand +
a11y sweep as the last structural debt. Pre-EAS-build action: audit the
workspace Expo SDK 54/55 hoisting skew (errors_log 2026-07-04).
