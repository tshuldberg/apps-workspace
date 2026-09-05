# 2026-07-17: Integration Merge Sweep - All Work Branches to Main

Founder ask: make sure all work on this computer is safely committed, merged to main, reviewed, and ready for testing.

## Starting state

- 15 branches unmerged vs `main` (baseline `2607ca5c`), 12 worktrees, 1 dirty file (memory.md stop-hook breadcrumbs on `feature/meerkat-plan43`).
- Containment analysis deduped the set: `fix/meerkat-plan41-audit-findings` (71 commits) contained `feature/meerkat-plan41-storage`, `docs/meerkat-plan41-audit`, and `feature/meerkat-plan25-calls`; `feature/meerkat-plan43` contained `wp43g-impl`.
- Three branches were content-equivalent to main already (verified with `git merge-tree`, identical trees): `docs/dowork-app-state-report`, `fix/rn-wildcard-peer-pin-2026-07-11`, `fix/workouts-hub-calculator-parity` (their content landed as `2607ca5c^`, `1910aecc`, `b317711a`).

## The merges (true merges, --no-ff, matching main's practice)

1. `46e15413` chore/repo-hygiene-2026-07-11 - memory.md resolved to main's newer RN-dedup truth.
2. `4d683504` feature/yearn-boost-integrity (plan 50) - ledger union; yearn boost row upgraded to Mitigated.
3. `c7b5b856` feature/yearn-plan47-phases-2-5 - **the hard one.** Two parallel boost-integrity fixes: plan 50 (App Store Server API, `yearn-activate-boost`, `grant_boost`) vs plan 47 (signed StoreKit JWS chain verification, `yearn-boost-activate`, `activate_boost_validated`, dirty-ledger-hardened migration). Plan 47's model chosen wholesale: newer, no Apple API credential dependency, hardened migration for live ledgers, full cert-chain test fixtures. Plan 50's edge fn deleted, vitest include repointed. Same-name migration add/add resolved to plan 47's version. Verified: 209 yearn app tests + 54 edge fn tests + typecheck.
4. `c1823df0` feature/mynews-plan48 - DMCA workflow, subscriptions, support rails.
5. `10dd78d9` feature/meerkat-production-readiness-2026-07-09 (plan 42 tail) - check:parity chain unioned (+`check:meerkat-transport-nc` alongside main's newer bestchef gates).
6. `d73e9828` fix/meerkat-plan41-audit-findings (71 commits) - relay conflicts resolved to this branch's newer lineage (it contained 6/7 production-readiness commits plus the push-gateway `getRegistration` by-hash fix). Required `CI=true pnpm install --no-frozen-lockfile` for new workspace deps (meerkat-call-native, expo-auth-session). **Branch defect found and fixed in the merge:** authored `packages/meerkat-icloud-storage/ios/` Swift sources were shadowed by the broad `ios/` gitignore rule and never tracked; recovered from the plan41 worktree, un-ignore exceptions added for meerkat-icloud-storage and meerkat-call-native.
7. `8f6b8017` feature/meerkat-plan43 - ledger unions; memory keeps post-audit state.
8. `739eef31` worktree-wp43g - community-node bin resolved to the newer superset lineage; announce suites 15/15.

## Review

- Opus reviewer audited the full conflict-resolution surface (7 target areas). Six clean; one real finding: orphaned plan-50 module `apps/yearn/src/lib/yearnBoost.ts` + test with a name-colliding duplicate `YearnBoostActivationError` class. Removed.
- Full-suite run exposed 2 failing dowork tests: fixture rot, not a code bug (hardcoded `createdAt: 2026-07-03` crossed the DL-4 14-day age backstop on 07-17). Fixtures now relative (`RECENT_ISO`); suite 559/559.

## Verification on merged main

- `pnpm typecheck`: 133/133 tasks.
- `pnpm test`: 133/133 tasks (full monorepo, after the two fixes).
- `pnpm check:parity` exit 0; `pnpm check:generated-artifacts` pass.
- Per-merge: relay 1507 tests, yearn 209+54, dowork 559, meerkat app typecheck, icloud package 11/11.

## Push + cleanup

- MyLife `main` pushed: `2607ca5c..eaac9de8`.
- Apps workspace repo: consolidation cleanup committed (MyBooks/MyVoice trees removed, all 22 stale MyLife submodule gitlinks + `.gitmodules` dropped) + workspace sync commit (instructions, skills, docs, nested project snapshots; MyLife content intentionally not embedded); pushed `789b746..9889ed1`.
- Local branches deleted: `wp43g-impl`, `docs/meerkat-plan41-audit`, `chore/repo-hygiene-2026-07-11`. Content-equivalent refs kept (on origin): dowork-app-state-report, rn-wildcard-peer-pin, workouts-hub-calculator-parity. Worktrees left in place in case their sessions resume.
- memory.md: 20 pre-07-12 session rows archived to `docs/archives/memory-sessions-2026-07.md`; Yearn rows corrected to the plan-47 model reality.

## Remaining

- Founder ops unchanged per app (all NO-GO gates are live-evidence, not code).
- Yearn founder ops now reference `yearn-boost-activate` (plan 47 fn), not the removed plan 50 fn.
- Worktrees for merged branches can be pruned when their sessions are confirmed idle.

## Addendum: activation runbook Step 1 (release candidate selection)

- Release id `meerkat-2026-07-17-rc1` created; ledger at `docs/releases/meerkat/meerkat-2026-07-17-rc1/` (evidence.json + evidence-summary.html + artifact subdirs).
- Bound to release SHA `10aaaf142c7451bf67dd561ca91192a7adaf8a2c` (main, pushed).
- `fix/meerkat-plan41-audit-findings` pushed to origin without force (118346ae).
- Step 1 recorded IN_PROGRESS, not PASS: no protected release branch/PR workflow and no remote CI exist to satisfy the exit gate; documented as open items needing founder configuration or signed exception. Steps 2-18 OPEN.
