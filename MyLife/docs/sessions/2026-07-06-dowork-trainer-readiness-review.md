# DoWork trainer-handoff readiness review, 2026-07-06

## Goal
Founder is ready to hand DoWork to his personal trainer for real client use. Requested: adversarial production-readiness review, git history review, docs-vs-code comparison, and two HTML guides (trainer user guide + remaining launch steps with an investigated EAS deployment decision).

## Method
4 parallel agents: git history audit, adversarial code review (at branch tip `836ce08c` in the `dowork-trainer-launch` worktree, read-only), docs-vs-code audit (13 docs, 15 claim spot-checks), EAS deployment investigation. Lead independently verified the branch-merge question with `git cherry` + content diffs and confirmed C1 on both main and branch.

## Key findings

### Corrections to prior record
- **The 2026-07-05 portfolio ruling's "C2 STALE, dp-audit wave already merged via d8070864" is WRONG.** `git cherry main feature/dowork-trainer-launch` shows 11 commits (`a277c125..836ce08c`) not patch-equivalent to main; `git diff main...feature/dowork-trainer-launch -- apps/dowork modules/workouts supabase` = 59 files, +2,694 lines. Includes migrations `20260704000002/3` which are ALREADY APPLIED to prod Supabase, so main is behind the deployed schema. Merge before any build.
- The branch's own `REPORT-dowork-trainer-pilot-readiness-2026-07-04.md` ("code-side 9/10, the blocker is not code") predates the C1 discovery and overstates readiness.

### C1 re-confirmed (both main and branch)
`session.tsx:238` boots the player via `createPlayerStatus` into `idle`; repo-wide grep shows zero `{ type: 'START' }` dispatches. Mark Complete disabled (`session.tsx:862`), Pause/Resume null in idle, voice coach gated on playing. No set can ever be logged. Escaped because all 20 dowork test files are data-layer; engine's 52 tests pass. Fix: dispatch START after load + screen-level test.

### Adversarial findings (full list in launch-steps report)
CRIT: C1 session dead; C2 no icon/assets dir; C3 ascAppId placeholder; C4 monetization dark (honest degrade); C5 legal links 404; C6 never run on hardware.
HIGH: H1 anonymous-first identity loss risk; H2 no timeouts vs paused free-tier Supabase; **H3 live unclaimed prod trainer invite code `DPI77V8MJY4L` committed in `app-review-notes.md` + redemption mints auto-verified live trainer (rotate!)**; H4 shared-secret RC webhook; H5 60-min signed URLs outlive moderation; H6 gross-only earnings (F4 undecided); H7 branch divergence.
MED: hardcoded USD CTA price, custom-scheme-only invite links, undocumented manual trainer-invite SQL (M3), no RC revoke on delete-account, offline-revoke offline window, non-atomic view counts, form-check TOCTOU.

### Architecture verdict
Solid: RLS on all 18 dw_ tables, 4-path server entitlement, signed upload/playback, honest paywall/offline degradation, real account lifecycle. Docs-code alignment 9/10.

### EAS decision (investigated)
Production build TODAY fails `check-build-env.mjs` by design (no RC keys). TestFlight blocked by missing ASC record. **Recommended: EAS internal distribution, preview profile**: guard skips preview; add `"environment": "production"` to the preview profile in eas.json to reuse the 5 existing prod env vars; `eas device:create` for the trainer's UDID; build + install link. Full trainer platform live against prod minus push/payments (pilot doesn't need either; client-link entitlement comps premium). eas-cli must run from founder terminal (sandbox breakage, errors_log 2026-07-04). No expo-updates = every fix is a rebuild.

## Deliverables
- `docs/reports/REPORT-dowork-trainer-user-guide-2026-07-06.html` (trainer-facing step-by-step, honest limitations section incl. C1)
- `docs/reports/REPORT-dowork-launch-steps-2026-07-06.html` (findings + git/docs audit + deployment comparison + Phase 0-3 runbook)
- Both opened in browser.

## Recommended sequence (from the runbook)
Phase 0 (code, ~half day): merge branch to main, fix C1 + test, rotate leaked invite, add invite-INSERT runbook snippet. Phase 1 (~half day founder): device:create, eas.json preview env line, preview build, keep Supabase warm (7-day pause!), onboard trainer w/ guide, white-glove QA. Phase 2: F8 icon, F2 ASC record, F3 RevenueCat, F6 APNs, production build → TestFlight internal/external. Phase 3: F4 split, F5 legal hosting + counsel, sandbox purchase matrix, App Review (refresh seeded codes).

## Not done (intentionally)
No code changes; user asked for review + guides. C1 fix, branch merge, and invite rotation are queued as Phase 0.

## Phase 0 execution (same session, evening)

Founder approved resolving all codeable issues before deploying. Executed with codex (gpt-5.5) as implementer, Fable orchestrating and reviewing; 3 commits on `feature/dowork-trainer-launch`, then merged to main and pushed.

- `fdf942ea` fix(workouts): C1. New `createStartedPlayerStatus` engine helper (create + START), used by DoWork AND hub mobile session screens (hub had the identical bug; web keeps its explicit Start button). Regression tests: started state, complete-set progression, pause/resume, idle constructor locked. workouts 535t.
- `1127ad24` fix(dowork): H1 + H2. `isAnonymousSession` helper; sign-out warns anonymous users (destructive confirm + "Add email first" path; sign-out row now visible to anonymous users instead of hidden); trainer/client invite redemption fail-closed requires email session; `withTimeout` (12s) on provider init + earnings with retry; `launch-environment` missing-config now renders honest copy.
- `01359c34` fix(dowork): M1 + share classification + hygiene. Neutral "Subscribe" CTA (paywall stays store-truth); shared `cloud-failures` classifier (transient: no_session/network/timeout/5xx; permanent: RLS/validation/4xx/unknown-default) wired into shares + coaching, permanent failures surface instead of fake "Saved offline"; leaked invite literals scrubbed from docs; runbook gained mint-invite SQL; CLAUDE.md upload-video drift fixed.

Prod ops (Management API, Supabase CLI keychain token): leaked trainer invite `DPI77V8MJY4L` expired, leaked client link ended, fresh 30-day trainer invite minted and stored in keychain ("DoWork trainer invite (rotated 2026-07-06)").

Merge: `0bc4152f` on main (memory.md + errors_log.md conflicts union-resolved; wrong "wave already merged" session-row claim corrected in place). Verified on merged tree: dowork 417t, workouts 535t, dowork/mobile/web typechecks, check:dowork-parity, pre-commit function gate. Pushed: `feature/dowork-trainer-launch` (01359c34) and `main` (17c7768f..0bc4152f, includes the previously local landing 3, which was verified green by its own session).

NOT fixed (documented, deliberate): M4 (RC revoke on delete: RevenueCat account doesn't exist yet), M6 (non-atomic view counts: needs an RPC migration, understatement-only), M7 (form-check TOCTOU, low practical risk), H4 (shared-secret webhook, revisit pre-scale), H5 (60-min signed URL moderation lag), two-brand visual seams. Both HTML reports updated to reflect Phase 0 completion.
