# DoWork production-quality review (plan 36, pre-TestFlight), 2026-07-04

Question under test: "UI/UX fully features the goals, easy on the users; are we
at 9/10 production ready?" Method: three parallel adversarial read-only
reviewers (goal coverage/journeys, UX friction/polish, production hardening)
over `apps/dowork` source + edge functions; orchestrator personally verified
every score-driving claim against source before accepting it.

## Verdict: 6.5/10, not 9

All three lenses independently scored 6.5/10. The trainer platform core
(invite -> Studio -> profile -> paywall -> coaching loop -> voice player ->
downloads) is genuinely end-to-end with honest states throughout, and 5 of 6
degraded-mode scenarios pass from source. The gap to 9 is a small set of real
defects plus structural debt, and the fact that zero behavior has ever run on
a physical device.

## Confirmed Criticals (verified in source by orchestrator)

1. FIXED (`e106c7e5`): Settings Account rows dropped onPress; the sign-in
   screen was unreachable (App Review demo login + device recovery broken).
2. UNRESOLVED: offline share queue unbounded flush loop + comment duplication
   + queues surviving sign-out (flush under next identity) + no attempts cap.
   See errors_log.md row.
3. UNRESOLVED: continuous voice control never restarts after the recognizer's
   own 'end' (OS silence timeout); flagship feature silently dies mid-workout.
   See errors_log.md row.

## High findings (agent-reported, spot-checks passed)

- Studio gate treats ANY getMyTrainerProfile failure as "not a trainer"
  (studio.tsx:69), showing the invite gate to a real trainer on a flaky gym
  connection. earnings.tsx has the correct error/Retry separation to copy.
- No report/block affordance on trainer videos, trainer profiles, or form
  checks (cloud-reports.ts already supports the target kinds); only the
  social feed has it. App Review Guideline 1.2 exposure.
- Push registration only happens inside Settings > Notification preferences;
  nothing prompts at trainer redemption, client join, or first form check, so
  the coaching loop's notifications never fire for normal users.
- form-check/[id] video failure = infinite spinner (failure text lands at the
  bottom of the composer, off-screen); no KeyboardAvoidingView on the
  composer (keyboard covers typing + Send).
- my-trainer partial fetch failures silently render as empty coaching space.
- Raw Supabase/RevenueCat error strings shown verbatim in multiple surfaces
  ("JWT expired", RLS violations); needs a friendly-error mapping layer.
- ~19 of the ported workout screens are stack-registered but orphaned (zero
  inbound routes): entire programs/plans cluster, gps, watch, ai-workout,
  generate, recovery, body-map, timer, warmup, superset, one-rm, exercises
  (full filterable library), share, onboarding, upload-video. Home "UP NEXT"
  card logic is dead as a result (depends on plans that cannot be created).
  Goal 7 (GPS/AI/recovery named) is materially overstated.
- Icon/splash assets do not exist (app.json has no icon key, no assets/ dir);
  ascAppId placeholder remains (known F2/F8).

## Medium/structural (selection)

Two-brand seam (hub gold #C9894D + lavender text on 16 ported screens vs iron
orange on trainer surfaces, third idiom on orphaned onboarding); a11y is
bimodal (new screens decent, ported half near-zero, Delete account button
unlabeled); first-workout funnel ~8 interactions behind a FAB labeled "Start
workout" that opens the builder; "Following" feed tab semantics fake (TODO in
cloud-shares.ts:286); watch.tsx is a reachable-by-deep-link stub; "About
DoWork" dead row; "End client" has no confirm; share flow says "failed" while
silently queueing (then double-posts); mid-playback network death leaves a
frozen player with no message; paywall can show hardcoded USD price before
store product resolves; sign-out wipes downloads before attempting sign-out
and swallows failure.

## Strong (real credit)

purchases.ts honesty (prefix-validated keys, server-truth entitlement,
pending-not-fake confirmation), playback-url server gate + downloads revoke
contract, demo gating production-safe, account deletion complete, paywall
disclosure copy complete, 5/6 degraded modes PASS (RC absent, env absent,
expired URL refresh, mic denied, push unprovisioned).

## Path to 9 (recommended order)

1. Queue subsystem fix (C2 cluster) ~1 day.
2. Voice restart-on-end fix + device verification ~half day + Phase 7 gym QA.
3. Studio error/gate separation; form-check video error state +
   KeyboardAvoidingView; my-trainer partial-failure surfacing. ~half day.
4. Report/block on trainer surfaces; push-registration prompts at redeem/join/
   first-form-check. ~1 day.
5. Friendly-error mapping layer; then either wire or unregister the orphaned
   screens (decide: ship programs/GPS/AI or cut routes + dead Home card).
6. F8 assets + F3 RevenueCat before any store build.
Device QA (white-glove checklist) is a hard prerequisite for claiming 9;
code-only review caps at ~8.5 even with all fixes.

Commits this session: `e106c7e5` (Account rows fix). Reviewer transcripts are
session-local; findings preserved here + errors_log.md.
