# 2026-07-03 BestChef Adversarial Production Review + Global Launch Plan (analysis + plan, no code)

## Goal
Re-review BestChef git history and production readiness adversarially, verify the prior analysis (2026-07-02 global-launch eval HTML report) rather than trusting it, and develop the execution plan for production in 7+ languages. Principal product design + engineering perspective; the user explicitly asked for an adversarial approach to all existing work.

## Method
- Direct verification: ran `check-i18n-parity.mjs` (exit 1, EN 807 vs 794 confirmed live), typecheck (clean), app tests (290/290), module tests (1135/1136), git history stats (78 commits, burst pattern, milestone diffstats, no work lost in merges, zero BestChef commits since 2026-06-19 on any branch).
- 4 parallel read-only Explore agents: (1) i18n deep audit incl. translation-quality sampling + hardcoded-string sweep, (2) cloud/backend audit incl. CHF-1 wiring, RLS, locale-hostile SQL, vote integrity, (3) ticket-ledger truth check + release-eng state, (4) principal product-design review (the discipline the prior report lacked).

## Deliverables
- `docs/reports/REPORT-bestchef-adversarial-production-review-2026-07-03.md` (review: verdict on prior report, corrections table, N1-N17 new findings, revised scores)
- `docs/plans/queue/33-bestchef-global-launch-7-languages.md` (7-phase execution plan + founder-ops ledger F1-F9)

## Verdict on the prior report
Directionally sound (~80 percent of checkable claims verified; all 15 blockers still valid) but too generous in 4 ways: treated i18n as UI-strings only, called vote integrity solid, had no design discipline, accepted "all 59 tickets closed" (F-008/F-010 are `/soon` stubs). Its own "1 hour" remediation (wire parity gate) never happened; 23 days idle.

## Key new findings (N1-N17, top items)
- N1 backend English wholesale: all `bc_notify_*` RPCs + `bc_profile_activity_v` bake English titles/bodies/tier labels/dates into Postgres rows; 100 percent of notifications English for all locales.
- N2 `slugify()` empty-slug: non-Latin dish creation fails on the second dish (unique violation). Hard blocker for ja/ko/ar/zh/th/hi markets.
- N3 vote integrity cosmetic: stub classifiers auto-approve everything; proof-hash dedup per-submission (one photo votes leaderboard-wide); free delete+revote; no durable social rate limits.
- N4 ~105-key untranslated compliance block (age gate, deletion, reporting, legal) in ALL non-Latin catalogs; completeness meter (70 percent threshold) never flags it.
- N5 `bc_job_config` silent no-op stalls GDPR deletions forever with zero signal; pg_cron absence silently unschedules.
- N6 `verify_jwt` deploy trap: delete-account + moderate_vote_proof 401 unless deployed `--no-verify-jwt`; recorded nowhere.
- N7 day-1 production core loop empty by design (seeds gated off in public builds; "come back later" copy; leaderboard empty state has no CTA).
- N8 no fonts loaded at all (typography.ts claim is false). Also: errors swallow to empty app-wide, Dynamic Type unclamped, white-on-saffron ~1.9:1, bookmarks device-local, staging-wired .env.local, bc_media_variants read leak, client-only block enforcement, 200MB vs 150MiB video mismatch, zero store metadata.
- Corrections: 7 edge functions not 6; 2 of 8 buckets public; missing-key fallback renders English not raw keys; CHF-1 is now fully WIRED (stale "unwired" memory falsified; errors_log row closed).

## Revised scores
Concept 8.5 (holds) / Execution 6.5 / Single-market GA 4.5 / 7-language readiness 2.5 / timeline 12-16 weeks.

## Plan 33 shape
Phase 0 truth+gates (parity gate, ledger reconciliation, env truth, deploy flags, job health) -> Phase 1 T&S/integrity floor (real classifiers+NCMEC, vote hardening, durable action quotas, moderator console, legal corpus, observability) -> Phase 2 backend localization (notifications to type+params codes BEFORE non-EN users exist, dish translations, slug fix, UGC language tagging) -> Phase 3 client localization completion (compliance block, hardcoded strings, fonts, CLDR plurals, RTL pass, pro review) -> Phase 4 media/push/scale (CDN, transcoding, push, upload queue) -> Phase 5 design launch pass (cold-start states, seed catalogs, error states, trophy framing, finish F-008/F-010 for real, IA cleanups) -> Phase 6 store ops + 4 market waves. Founder-ops ledger F1-F9 separated.

## Verification run
- check-i18n-parity exit 1 (expected, documented); typecheck clean; app 290/290; module 1135 pass/1 skip. No code changed; `pnpm gate:function:changed` skipped (docs-only session).

## errors_log updates
- CHF-1 row (2026-06-09) closed as Resolved (wired in Wave 1, re-verified today).
- i18n drift row updated (re-confirmed, points at plan 33 Phase 0).
- 3 new Unresolved rows: slugify non-Latin crash, fonts never loaded, vote-proof integrity cosmetic.

## Execution (same session, founder said "Begin")

Plan 33 Phase 0 COMPLETE plus two pulled-forward fixes, 7 commits on `feature/meerkat-launch-finish`:

1. `docs commit` review + plan + this log.
2. `506422a7` Phase 0.1: 13 drifted keys translated into all 20 catalogs (real translations, register-matched du/tu; CookProof kept as brand term) -> 807/807 at 100 percent everywhere; gate wired three ways (root `check:i18n-parity`, appended to the `check:parity` chain so the CI parity job + TaskCompleted hook enforce it, scoped pre-commit leg when staged files touch the i18n tree).
3. `440b06e4` Phase 0.2-0.3: ticket ledger reconciled (57 Done / 2 Reopened: F-008, F-010 with code-level reasons), mission control gained a 2026-07-03 Status Delta correcting 2.5 months of staleness.
4. env-truth commit, Phase 0.4-0.5: app.json iOS-only (Android block dropped, no native project exists), `eas-build-pre-install` guard `assert-eas-production-env.mjs` (+5 tests) fails a production build not wired to the prod ref at BUILD time, config.toml gained declarative `verify_jwt=false` for the 2 worker functions, CLAUDE.md EAS Environment Contract + honest launch state.
5. job-health commit, Phase 0.6: `bc_job_health()` service-role RPC (migration `20260703000001`) surfaces the two silent job failure modes (missing bc_job_config rows, absent pg_cron/pg_net) plus rankings freshness and deletion backlog. Statically verified; exercised at `supabase db push` (F1).
6. `02bf6e14` Phase 2.4 (pulled forward): unicode-safe `slugify()` via TDD (11 assertions red first). Three tiers: unchanged ASCII pass (Latin slugs byte-identical), Unicode `\p{L}\p{M}\p{N}` NFC fallback (marks matter: Thai tone marks/Devanagari matras are `\p{M}`; NFD Hangul must recompose), deterministic `dish-<fnv1a>` never-empty fallback. Module suite 1141 green.
7. `2efa6581` Phase 3.4 (load half, pulled forward): standalone app now actually registers the 5 Jakarta weights (mirrors hub `(recipes)/_layout.tsx`, error-escape so startup never blocks). Verified typecheck + 295 app tests + iOS export (12 MB hbc).

Adversarial posture applied to my own report during execution, 2 corrections:
- N6 was overstated: `deploy-functions.sh` (PR #11) already encoded the `--no-verify-jwt` split with invariant comments; residual (no declarative config.toml mirror) closed this session.
- N13 first half RETRACTED: the `bc_media_variants` EXISTS subquery composes with parent `bc_media_assets` RLS (Postgres applies row security to tables referenced inside policies), so there is no variant leak. Client-side-only block enforcement still stands.

Final verification: `pnpm check:parity` full chain exit 0 (new i18n leg included), generated-artifacts guard pass, app 295/295, module 1141/1142, typechecks clean.

errors_log: closed i18n-drift, slugify, and fonts rows (commits referenced); CHF-1 row closed earlier in session.

## Remaining items
1. Plan 33 Phase 1 codeable next: durable action rate limits (`bc_consume_action_quota` in the CHF-1 pattern), vote integrity (per-user global proof-hash dedup, `bc_delete_vote` throttle), moderator console, server-side block enforcement, legal corpus text. Then Phase 2.1 backend notification type+params rewrite BEFORE any non-EN user exists.
2. Founder decisions F1-F9: prod dashboard verify (incl. `bc_job_config` rows; then `select bc_job_health();`) + region record, legal hosting, classifier + video + translation vendors, store listings, seed-content approval, protected cadence.
