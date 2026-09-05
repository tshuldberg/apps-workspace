# 2026-07-11 Repo Hygiene Sprint (Plan 49 W8)

Fable-orchestrated hygiene pass on branch `chore/repo-hygiene-2026-07-11` (worktree off `origin/main` at `6f8e6545`). Fable decided dispositions and verified outputs; three sonnet agents did the mechanical work (one running the deep investigation through Codex gpt-5.5).

## Item 1: errors_log.md archive (done, commit `b50dcfad`)

- errors_log.md was at 347 data rows, past the ~150-row threshold.
- Archived 188 rows to `docs/archives/errors-log-archive-2026-07-11.md`: 127 Resolved rows dated 2026-07-05 or earlier plus 61 stale never-upgraded auto-logged stubs from the same window. 159 rows remain.
- Verified by lead: 159 + 188 = 347; zero non-auto-logged Unresolved rows in the archive; zero Mitigated rows archived; zero rows dated 2026-07-06+ archived; the manual Unresolved DoWork live-session row, the Metro `require(name)` row, the BestChef vote-proof row, and the CSP Material Symbols row all remain in the live log.

## Item 2: Stop-hook breadcrumb spam (done, commit `f42800da`)

- Root cause: `.claude/hooks/stop-update-memory.mjs` deduped only on a minute-precision sentinel, so every Stop event in a new minute re-appended the same "Auto-logged: <commit>" row (162+ collapsed twice this week; reproduced live during this session at 00:36, 00:37, 00:40).
- Fix: the hook now also skips when the most recent auto-logged Sessions row carries the same HEAD commit hash. Logic extracted to `.claude/hooks/lib/stop-memory-core.mjs` (pure functions, no fs/git on import); entry hook is a thin shell.
- Tests: `.claude/hooks/__tests__/stop-update-memory.test.mjs`, 8 cases, node:test only, run with `node --test "./.claude/hooks/__tests__/*.test.mjs"`. 8/8 pass, re-run by lead. Agent also ran an end-to-end check of the real hook script against a temp memory.md with a stubbed git; the exact spam scenario (same commit, different minute) no longer appends.
- Note: the fix takes effect in a checkout once this branch merges; until then the live tree's hook still spams one row per minute-distinct Stop. The main checkout was mid-merge (Plan 42 session), so the fixed hook was deliberately not copied there.

## Item 3: stale worktrees (done, no commit needed)

Removed 6 worktrees after verifying each was clean (`git status --porcelain` empty) and its branch content-merged into `origin/main` (`git merge-tree --write-tree origin/main <branch>` equals the origin/main tree, which is the correct check under squash/merge workflows):

- `.claude/worktrees/bestchef-production-readiness-2026-07-09` (docs/bestchef-production-readiness-2026-07-09)
- `.claude/worktrees/dowork-trainer-launch` (feature/dowork-trainer-launch)
- `.claude/worktrees/track-c-consumer` (track-c-consumer)
- `.claude/worktrees/track-d2` (track-d2)
- `.claude/worktrees/main-merge` (main, idle at origin/main tip)
- scratchpad `yearn-wt` (feature/yearn-production-readiness)

Branch refs were NOT deleted; that decision is with the founder. Candidates now merged and worktree-less: `docs/bestchef-production-readiness-2026-07-09`, `feature/dowork-trainer-launch`, `track-c-consumer`, `track-d2`, `feature/yearn-production-readiness`, plus older merged refs (`track-c2-composer`, `worktree-agent-*`, `feature/dowork-production-readiness`, etc.) if the founder wants a broader sweep.

## Item 4: debt investigation findings (done, ledger updated this commit)

Investigation by Codex gpt-5.5 (read-only) with independent spot-verification of every citation by the wrapper agent and again by the lead (root override, wildcard peers, dual lockfile entries, vitest exclude block).

### A. "@types/react out of sync with Expo expectations" debt row

- No real `@types/react` drift exists: root `package.json` `pnpm.overrides` pins `@types/react: 19.1.17` and `react: 19.1.0`; the lockfile has exactly one `@types/react` entry; Expo SDK 54 expects `^19.1.0`. The row's framing was stale and has been corrected in memory.md.
- The real risk behind "duplicate native runtimes" is different: `react-native` resolves to BOTH 0.81.5 and 0.84.1 in pnpm-lock.yaml. All apps link RN 0.81.5, but at least 8 hub modules (bestchef, workouts, cycle, garden, health, meds, mood, nutrition) link RN 0.84.1, because 20 modules declare a `react-native: "*"` peer and `autoInstallPeers: true` picks a transitively-satisfying version.
- Verdict, Fix: pin `"react-native": "~0.81.5"` in the module package.json peers (20 modules declare the wildcard), `pnpm install`, then verify pnpm-lock.yaml has a single `react-native@0.81.5` entry. Runtime blast radius is bounded today (Metro dedupes per app), but a stray direct import from module code could pull the wrong RN build. Queued as its own follow-up task; not applied in this hygiene pass because it churns the lockfile and needs a full gate run.

### B. Mobile vitest memory-heavy route exclusions

- `apps/mobile/vitest.config.ts:56-73` excludes 4 files: Words index (OOMs alone even with 8 GB heap), hub Settings + Automations (shared import graph, 6 GB heap OOM in isolation), and Books home (unrelated `@react-native/assets-registry` ESM/CJS mismatch).
- Empirically re-proven during this pass: a copy of the Settings test run as a single file in a single fork with the known `@mylife/ui` mock workaround still never produced a result and was SIGKILLed at 150s (exit 137). The config already uses `pool: 'forks'`, `maxWorkers: 2`, 6 GB heap.
- Verdict, Wontfix at config level: this is a component render memory leak in those screens' jsdom render trees, not a test-runner configuration problem. Re-enabling requires fixing the components' render/memory behavior or a lighter rendering strategy for those tests. Debt row retagged accordingly so nobody re-attempts a config-only fix.

## Verification summary

- Hook tests: 8/8 pass (lead re-run).
- Archive invariants: all pass (lead re-run, counts and grep proofs above).
- Worktree removals: `git worktree list` re-checked after removal; the 6 targets are gone, unrelated worktrees untouched.
- Pre-commit function gate passed on both code-bearing commits.

## Remaining founder decisions

1. Delete the now-merged, worktree-less branch refs listed under Item 3? (Local refs; some also exist on origin.)
2. Merge `chore/repo-hygiene-2026-07-11` to main (squash per repo convention). Until merged, the Stop-hook spam continues in live checkouts.
3. Approve the follow-up task to pin `react-native: "~0.81.5"` across the 20 wildcard-peer modules.
