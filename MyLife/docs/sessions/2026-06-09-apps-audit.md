# Full-Scale Apps Audit - 2026-06-09

Autonomous session on `feature/manhattan-scaffold`. Goal: full function + security + gaps + git-history + documentation audit of MyLife and its standalone apps (Yearn, BestChef, Manhattan, DoWork, hub shell), delivered as a self-contained HTML report with recreated, pin-annotated screen mockups. Extends and re-verifies the 2026-06-08 baseline rather than repeating it.

## Deliverable
`docs/reports/REPORT-mylife-apps-audit-2026-06-09.html` (158 KB, self-contained). 12 sections: executive verdict + readiness scoreboard, 14-critical re-verification board, per-app deep dives (Yearn, Manhattan, BestChef, DoWork, hub shell) each with git timeline, works/stubbed evidence, P0-P2 gaps, CSO-format findings, and HTML/CSS screen recreations with pulsing callout pins (11 phone frames + 1 browser frame, 41 pins, real strings quoted from source); cross-cutting security (monetization status, RLS table, filterable findings explorer); git history (velocity chart, branch census, divergence + merge order); documentation health; sequenced remediation roadmap; methodology + disclaimer. Verified headless on :8801: only console error is favicon 404; severity filter and reveal animations work.

## Method
Six parallel general-purpose agents (CSO comprehensive mode embedded in prompts): one per app, one security re-verifier (all 14 criticals + secrets archaeology over 970 commits + CI/CD + supply chain + LLM + RLS + data-at-rest), one git/docs historian. Baseline findings extracted from yesterday's report JSON into /tmp/audit-baseline-brief.md. bclh branch audited via read-only worktree at /tmp/mylife-bclh (Yearn source + newest BestChef live only there). Manhattan audited at working-tree state including the uncommitted RevenueCat pass.

## Headline results
- Readiness: BestChef 5.0, Yearn 4.0, Manhattan 4.0, Hub shell 4.0, DoWork 3.5 (avg 4.1 vs yesterday's 5.4 module average). Pattern: "built, not connected."
- Criticals: 13/14 STILL OPEN, C14 partially fixed (Manhattan only). Paywall family root cause unchanged: `packages/entitlements/src/test-mode.ts:11` `_testMode = true`.
- 27 new findings. Top: Manhattan post-paywall crash (`hub_module_locks`, MAN-1 CRITICAL; independently found by the parallel production-eval session and FIXED mid-audit in `5c89171e7`, re-verified at HEAD `4a0223ca8`) and env aliasing repeating the BestChef build-16 bug so prod builds cannot configure RevenueCat (MAN-2 HIGH, STILL OPEN at HEAD incl. seatgeek.ts and absent eas.json env blocks); BestChef cost ledger + kill switch exist but are never called by the LLM brokers while anonymous sessions are unlimited (CHF-1 HIGH); web auth cross-account session race still open (HUB-1 CRITICAL); SQLite + backups unencrypted with plaintext surf passwords, mail passphrase, LLM keys inside (XC-2/3/4 HIGH/MED).
- Yearn: E2EE is real NaCl-box with Keychain keys but write-only; no decrypt UI, no composer, no moderation/NCMEC, no monetization; base schema not in repo.
- DoWork: stalled since 04-28; both edge functions 501; magic link never exchanges; deletion unreachable; UGC feed without report/block.
- Secrets history CLEAN across all 970 commits; CI STRONG (SHA-pinned, osv gating); supply chain ADEQUATE (next/axios ignores expire 2026-07-15).
- Git: merge order recommended: push c22ee317d, land PR #11 (bclh) first, then rebase only b2fd9a73d (the other 33 manhattan commits are already patch-equivalent on origin/main), fast-forward main, commit the uncommitted RevenueCat pass + audit artifacts. Only 4 overlapping files (memory.md, errors_log.md high conflict).
- Docs: root CLAUDE.md stale on ~8 counts (39 vs 40 IDs, wiring lists, free tier 5 vs 9, prefix table, submodule era); apps/manhattan has zero docs; memory.md was 143 lines (stop-hook dupes collapsed this session, now ~99; full archival pass still needed); docs/plans queue holds shipped work.

## Mid-audit repo movement (important)
Parallel production-eval sessions ran the same day and landed commits while this audit's agents were reading: `639e67995` (commits the RevenueCat pass this audit reviewed as working-tree), `5c89171e7` (fixes the MAN-1 crash + mounts ShareIntentProvider + hides AI toggle + honest labels), `4a0223ca8` (eval report docs), then `1a8ab2e38` + `177ed6b44` (store-readiness batch) during final reconciliation. Affected findings were re-verified through HEAD `177ed6b44` (23:57) and the report labels them "fixed mid-audit". MAN-2 (env aliasing) was re-confirmed open after every one of those commits, with eas.json env blocks present but empty. MAN-2 (env aliasing), eas.json env blocks, MAN-3/4/5, and all hub/BestChef/Yearn/DoWork findings were confirmed still open at HEAD. A DoWork session was visibly in flight at publication (working-tree edits). The four per-app eval reports in docs/reports from those sessions are siblings; this report is the consolidated, re-verified, cross-cutting view.

## Files changed this session
- Created: `docs/reports/REPORT-mylife-apps-audit-2026-06-09.html`, this log.
- memory.md: added session row (stop-hook dedupe attempted; the parallel session had already curated it to 56 lines).
- errors_log.md: 2 new Unresolved rows (Manhattan env aliasing MAN-2; BestChef quota/kill-switch unwired CHF-1). MAN-1 already had a Resolved row from the eval session.
- No source code modified (audit was read-only). Worktree /tmp/mylife-bclh removed after use.

## Remaining / next
- Execute the P0 roadmap (report section 11): flip test-mode default + CI assert, web session fix, onboarding loop, dining/travel/shop migration map, Manhattan env-read conversion + eas env + device QA, BestChef quota wiring + prod Supabase + real moderation.
- Merge order (report section 09): push c22ee317d, land PR #11 first, rebase the 4 new manhattan commits, fast-forward main, commit audit artifacts.
