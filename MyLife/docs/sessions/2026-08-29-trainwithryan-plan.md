# 2026-08-29: TrainWithRyan repo + build plan

## What

Created a new standalone repo at `Apps/TrainWithRyan` (git init, commit `0c02b2a`) for Ryan's dedicated single-trainer personal training app, forked from DoWork, and authored the full build plan plus the orchestration kickoff prompt for the build session.

## Why

Founder request: Ryan (the first trainer identified 2026-08-12; mobility, strength, fascia, yoga; large video library) gets his own dedicated app rather than the multi-trainer DoWork marketplace. DoWork confirmed as the most complete workout surface (87/100, 2026-08-12 adversarial review) via a fresh code inventory this session.

## Key facts established (inventory, verified in-repo)

- DoWork: 75 screens (~28k lines), 19 `dw_*` cloud tables, 6 edge functions, ~1,200 tests; trainer platform code-complete (signed video pipeline, 4-path entitlement, voice player, coaching loop, RevenueCat, push, offline downloads).
- Missing for Ryan's product (net-new in the plan): real-time chat, program assignment to clients, live workout tracking, scheduling/booking, cloud session sync/reporting, video collections. No Supabase Realtime usage exists in DoWork today.
- Closed vendored dependency set for extraction: `@mylife/{workouts,ui,db,auth,sync,module-registry,errors}`.

## Deliverables

- `Apps/TrainWithRyan/docs/plans/twr-build-plan.md` + same-basename `.html` twin (opened in browser): Phase 0 extraction + rebrand + single-trainer conversion (server-enforced one-trainer guard, role-based shells, monetization collapse), FA-1..FA-7 feature areas with locked contracts and file-ownership zones, founder-ops ledger R1-R8, acceptance criteria.
- `Apps/TrainWithRyan/docs/plans/twr-orchestration-kickoff-prompt.md`: fresh-session protocol; Fable orchestrator, Opus builders (worktrees, one per work package), Codex (gpt-5.5) reviewers via `codex review`/`codex exec`, Fable adversarially verifies then gates, commits, pushes, merges each package.
- Repo scaffold: README, AGENTS.md + CLAUDE.md stub, PROJECT_LOG.md, .gitignore.

## Decisions locked in the plan

- Fork, not extend: DoWork stays MyLife's marketplace; TrainWithRyan diverges.
- Keep `dw_` schema prefix in the new dedicated Supabase project (rename is churn).
- Community feed scoped to Ryan's client circle; moderation rails stay.
- Pricing never invented; R3 founder+Ryan decision.
- Plan 55 items that travel with forked code (RC webhook hardening, router pollution, file-system/legacy migration, test floor, RIR/set types) are folded in; MacroFactor gap build stays DoWork roadmap.

## Remaining

- Build not started. Kick off a fresh Fable session in `Apps/TrainWithRyan` with the kickoff prompt.
- Founder-ops: R1 GitHub remote, R2 Supabase project, R3 ASC/RevenueCat + pricing with Ryan, R4 legal hosting, R5 push keys, R6 Ryan brand kit, R7 TestFlight testers, R8 business terms.
