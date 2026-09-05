# MyNews production audit + Track 0 security fixes — 2026-07-05

## What
Comprehensive production/security audit of MyNews (modules/mynews, apps/mynews, apps/mynews-web, supabase/functions/mynews-*, migrations 20260703000001..3), a readiness decision, Track 0 security fixes, and the launch-readiness plan.

## Verdict
Phases 0-2 (scaffold, publish/read, editing desk) are production-grade and green (module 302, app 158, web 45 + typechecks + web build + parity). NOT launch-ready as a public app: the UGC moderation/legal floor (Phase 3) is unbuilt, and it is not deployed. Founder chose the full public-launch path.

## Findings
- **F1 (HIGH, fixed):** `nw_edit_suggestions` client INSERT RLS policy was pure attack surface. All legit suggestions ride the service-role `mynews-suggest` edge function; direct PostgREST insert bypassed ed25519 signature verify + open-suggestion cap + near-dupe collapse (unsigned corpus, queue flooding).
- **F2 (HIGH chained, fixed):** web suggestions page rendered citation URLs as unvalidated `href`; shared `toCitations` mapper did no scheme check either; a `javascript:` citation (reachable via F1) = stored XSS on the public reader. Expo app already guarded.
- **F3 (MEDIUM deploy-trap):** `mynews-review` relies on Supabase `verify_jwt=true` (parseJwtSub decodes without verifying). config.toml defaults it on; runbook must never deploy review with `--no-verify-jwt`.
- **R1 (CRITICAL for public launch):** no UGC moderation/legal floor — nw_reports has no writer, no report/block/mute UI, no moderation console, no DMCA/NCII, no legal docs. Apple 1.2 + DMCA + DSA gate.
- **R2:** not deployed (founder-ops).
- Clean: secrets, RLS hardening, markdown rendering (escaped React text, no HTML pipeline), honesty boundary, SecureStore key custody, build guard.

## Track 0 fixes (DONE, committed 56297fec)
- F1: migration `20260705000001_mynews_suggestion_insert_lockdown.sql` drops the client insert policy + adds a before-insert guard (blocks authenticated/anon direct inserts, requires non-empty signature).
- F2: `toCitations` (cloud-fetch.ts) filters to https-only; web `safeCitations` (format.ts) guards the render.
- Tests: module 303 (+1), web 48 (+3), app 158, all typechecks, web build, check:mynews-parity, gate:function:changed green.

## Deliverables
- `docs/reports/REPORT-mynews-production-audit-2026-07-05.{md,html}` (opened in browser).
- `docs/plans/queue/39-mynews-launch-readiness-safety-legal-floor.md` (Tracks 0-3).
- Branch `feature/mynews-launch-readiness` (off main): commits `56297fec` (fixes), `52a09aae` (report + plan).

## Next
Execute Plan 39 Track 1 (safety + legal floor) — the real public gate. Track 2 deploy is founder-ops. Then submit. F3 runbook note folded into Track 2.
