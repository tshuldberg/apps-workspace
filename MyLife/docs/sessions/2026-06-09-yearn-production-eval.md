# 2026-06-09 - Yearn Production Evaluation (Expo rewrite)

## Summary

Full comprehensive evaluation of the Yearn dating app Expo rewrite (`apps/yearn`), covering git history, feature functionality, security, plan progress, and the path to production. Produced a self-contained animated HTML report with all 8 shipped screens rebuilt as HTML mockups for visual reference.

**Artifact:** `docs/reports/REPORT-yearn-eval-2026-06-09.html` (111KB, animated, interactive onboarding stepper + discover deck state switcher)

## Where Yearn lives

- Source is NOT on the current `feature/manhattan-scaffold` branch. It lives on `feature/bestchef-launch-hardening` (tip `c22ee317d`), read via the existing worktree at `/private/tmp/mylife-bclh`.
- Main checkout's `apps/yearn/` holds only orphaned gitignored build artifacts (dist, node_modules, tsbuildinfo).
- Two yearn commits: `77837ed36` (2026-05-30, scaffold + core loop, 63 files, +9,110) and `3f8dccc07` (2026-06-06, encrypted intros + social surfaces, 33 files, +4,062).
- Product reference: native SwiftUI app at `/Users/trey/Superapp-Projects/need-works`. Locked plan: `/Users/trey/Superapp-Projects/YearnProdLaunch.html` (11 sprints, 61 tasks).

## Verdict

NOT production ready. 43/100 vs the locked full-vision public TestFlight beta (up from 34 at plan lock). Strong verified S0-S2 foundation; hosted backend unverified; chat unreadable (no decrypt/send UI); safety/moderation/monetization/compliance stack absent.

## Verified this session

- 115/115 tests pass (18 files, 590ms) by symlinking main-checkout node_modules into the worktree (symlinks removed after).
- `tsc --noEmit` clean.
- All 30 source files (8,670 lines), 18 test files (2,741 lines), 6 yearn migrations (986 lines) read.
- NOT verified: hosted Supabase state, EAS builds, on-device flows, live auth providers. All tests are mocked unit tests.

## Key findings

- Plan progress: 16/61 done-local, 3 partial, 42 open. Commit 2 quietly completed LOOP-04 (likes inbox), which the plan doc still marks open. Zero tasks hosted-verified.
- Feature truth: auth (4 providers), onboarding upsert, photo upload, deck, like/pass, likes inbox, matches, archive, block, report, E2EE intro send are REAL. Chat decrypt/send, read receipts are lib-only stubs (zero callers). Boost/Star local-only. Membership RPC called only by dev harness. Offline cache fully built and tested but wired into nothing. Push/geo/calls/verification/NSFW/NCMEC/RevenueCat absent.
- Security: 3 High (key-directory MITM with no verification; envelope-trusted sender key spoofing; core PII schema + RLS absent from repo with silent-skip migrations), 3 Medium (self-attested age gate vs promising permission copy; deep-link session fixation via raw setSession; fail-open private photo RLS + 30-min signed URLs), 4 Low. Strong hygiene: fresh nonces, SecureStore keys, plaintext intros blocked client+SQL, disciplined definer RPCs, ATS/backup/data-protection hardening, zero PII logging.
- The single unresolved errors_log row (stale Supabase CLI link `zjxabnazbdocrqpyixgo` vs Yearn project `kclsicgiutrtymjtuizq`, missing DB password) gates P0 #1 and every hosted claim.

## Two paths (owner chose both views)

- Full-vision plan: 22-28 weeks remaining (S2 finish through S10).
- Minimum defensible beta: 7-9 weeks. Keeps the legal/App Store floor (NCMEC, UGC 1.2 moderation operation, account deletion, age rating, legal docs, privacy label, hosted migrations + 2-device QA, real chat UI, durable rate limits, F1/F2/F5/F6 fixes, geo minimum). Defers LiveKit, selfie verification, RevenueCat (free beta), advanced filters, panic/trip share, Signal-grade ratchet.

## Method

5 parallel read-only agents (onboarding UI spec, shell/deck/social UI spec, security audit, feature matrix, plan extraction + config audit) over the worktree, synthesized with direct reads and a live suite run. AskUserQuestion locked scope first: both eval baselines; report in MyLife docs/reports.

## Files changed

- Created `docs/reports/REPORT-yearn-eval-2026-06-09.html`
- Created this session log; memory.md Sessions row + yearn Project State line; collapsed duplicate auto-logged memory rows
- No app code modified; no function logic changed (function gate not required). Temporary worktree node_modules symlinks created and removed.
