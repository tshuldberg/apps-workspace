# Orchestrator prompt: Meerkat review follow-through (one agent at a time)

Paste everything below the line into a fresh Claude Code session running Fable 5.1 in `/Users/trey/Desktop/Apps/MyLife`.

---

You are the Fable 5.1 orchestrator for the Meerkat review follow-through. You run exactly ONE subagent at a time, never two, and you verify every agent's claims against the gates yourself before starting the next. You manage prompts, verification, commits, and the ledger; agents do the reading and the code.

REPO: /Users/trey/Desktop/Apps/MyLife. Read, in this order, before spawning anything:
1. AGENTS.md at the repo root and apps/meerkat/AGENTS.md (binding rules: transport honesty, two-identity wall, parity twins, no em dashes, error log, session memory).
2. docs/reports/REPORT-meerkat-fable-review-2026-09-01.md (the findings and the fixes already applied).
3. docs/sessions/2026-09-01-meerkat-fable-full-review.md (what was verified and what was left).
4. apps/meerkat/docs/prompts/REVIEW-FLEET-2026-09-01.md (the seven review prompts that never ran).
5. /Users/trey/Desktop/Apps/.claude/skills/recursive-bug-hunt/SKILL.md (the agent template and the Learnings list every agent must hunt).

SETUP (do it yourself, no agent):
- Confirm a clean tree and note the current branch and SHA. Branch `fix/meerkat-fable-review-2026-09-01` (commit 813461c8) holds the applied fixes; if it is not yet merged to main, merge it first with a true merge, re-run the full gate battery on the merged tree, and only then continue.
- If another session is active in this checkout (dirty files you did not create, commits landing that you did not make, or worktrees under .claude/worktrees with dirty trees), move ALL of your work into your own worktree at .claude/worktrees/meerkat-review-followthrough on branch feature/meerkat-review-followthrough and never touch the main checkout again this session.
- Record the baseline yourself: `pnpm --filter <pkg> typecheck` and `test` for @mylife/sync, @mylife/meerkat-relay, @mylife/meerkat-app, @mylife/meerkat-web; `node scripts/check-meerkat-parity.mjs`; `pnpm check:esm-require`. Write the numbers down; they are the truth you compare every agent against.
- Track the work sets below as tasks.

WORK SETS, STRICTLY SEQUENTIAL. For every set: spawn one agent, wait for it, verify, then spawn the next. Spawn with the Agent tool, `subagent_type: general-purpose`, no model override (it inherits Fable 5.1). If an agent dies at spawn with a session-limit message, stop, tell the founder the reset time, and resume from the same set after the reset; never work around it by spawning more agents.

Set 1 to Set 7: the seven review dimensions from REVIEW-FLEET-2026-09-01.md, in this order: rv-relay, rv-sync-crypto, rv-sync-data, rv-mobile, rv-web, rv-goals, rv-process. For each dimension:
  a. Spawn the READ-ONLY review agent with the fleet prompt verbatim (common preamble plus its row), adding: "Findings already fixed in REPORT-meerkat-fable-review-2026-09-01.md are closed; report only regressions of them."
  b. When it returns, verify each CRITICAL and HIGH finding yourself against file:line before believing it. Discard anything you cannot confirm; downgrade anything the evidence does not support.
  c. Spawn ONE fix agent from the recursive-bug-hunt template with TARGET = the confirmed findings of that dimension (severity order), SCOPE = the files those findings name plus their twins, CHAIN_DIR = apps/meerkat/docs/prompts. It must root-cause before fixing, fix on every surface that has a twin, add tests that fail when the fix is reverted, run the full gate set, and write the next chain file.
  d. Verify yourself: re-run the gates, diff the tree against your pre-set snapshot, confirm the changed files match its claims, revert one fix locally to watch its test go red, then restore it.
  e. Commit that set as one Conventional Commit on your branch (no push). Add error-log rows for real defects, one line to memory.md, and fold generalizable lessons into the skill's Learnings section (merge, dedupe, cap 15 bullets).

Set 8: R3, recipient-signed join ack. Spawn one fix agent: SCOPE packages/meerkat-relay/src/community-join-queue.ts, community-node-http.ts (join/ack route), the @mylife/sync community-join client that drains and acks the node box, and its mobile and web callers. Requirement: an ack is accepted only when signed by the recipient device key over (communityId, token, ids, ts) using the feed-auth verifier the node already has; unsigned acks return 401 with a typed reason; list stays token-addressed. Tests: forged ack refused, replayed ack refused, real drain still clears its own box, both stores.

Set 9: P1, shared-core extraction. Spawn one fix agent: measure the drift list first (diff every apps/meerkat/app/(root)/data/*.ts against its apps/meerkat-web/src/lib twin, excluding import lines), then move every pure core whose only intended difference is imports into one shared package (packages/meerkat-core, TypeScript, no platform imports, consumed by both apps), starting with channel-view-core, community-template-commit, humanity-core, channel-history-import, persona-core, join-flow, onboarding-core. Leave true platform adapters (expo-*, web-*, account vs account-core, call-media-backend) in place. Extend scripts/check-meerkat-parity.mjs with a lock that lists the moved files and fails if either app re-grows a local copy. All four suites, both typechecks, parity, and `pnpm gate:function:changed` green before it returns.

Set 10: P2, god-file split. Spawn one fix agent per file, one at a time, in this order: apps/meerkat/app/(root)/data/community-core.ts, apps/meerkat-web/src/lib/meerkat-data.ts, apps/meerkat-web/src/lib/MeerkatProvider.tsx, apps/meerkat/app/(root)/providers/SyncProvider.tsx. Split by domain (community, dm, library, canvas, public, sync) behind the existing barrel so no import path outside the file changes in that commit; the providers compose domain hooks instead of owning every seam. No behavior change; the proof is identical test results and typecheck on both surfaces plus parity green.

Set 11: S1 plus hygiene. One agent: add a test in packages/sync that the intersection of names exported by index.ts and index.native.ts is identical and that the platform-only sets are the documented ones; run `pnpm audit --json` per package with a 10 minute timeout and list every advisory with severity, reachability from production code, and the fix or the documented ignore lane; delete the stray untracked apps/meerkat/errors_log.md and apps/meerkat/.claude/memory/ if they still exist.

STANDING RULES
- Never two agents at once. Never trust an agent's verification text; gates are truth, and stale editor diagnostics count for nothing.
- Out-of-scope bugs an agent finds get routed to the matching later set, logged in errors_log.md as Unresolved, never fixed out of order and never dropped.
- Each set ends with: gates green on the whole battery, one commit, error-log rows, memory.md row, chain file written, skill Learnings folded. Never push.
- Honesty boundary is absolute: no fix may render a connected, sent, delivered, online, or verified state that does not come from a real engine session, protocol row, or probe.
- Report to the founder at every set boundary: what was found, root causes, what was live-verified versus test-only, the commit SHA, and anything only the founder can do (devices, store consoles, credentials, deploys).
- Finish by writing docs/sessions/<date>-meerkat-review-followthrough.md, updating docs/reports/README.md if any report changed, and capturing a summary to Open Brain with context "personal, mylife".

Begin with SETUP now, then run the sets without waiting for me.
