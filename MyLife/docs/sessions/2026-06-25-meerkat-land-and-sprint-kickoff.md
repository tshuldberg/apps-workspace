# Meerkat land to main + MyLife improvement sprint kickoff

Date: 2026-06-25

## What was done

### 1. Landed the Meerkat branch to main (in full, safely)

The user asked to get `feature/meerkat-prompt01-ia` onto `main` safely and in full before
starting any new work, then to cut a fresh branch for the improvement sprints.

Divergence facts (read-only, before acting):
- `feature/meerkat-prompt01-ia` was 15 ahead / 0 behind `origin/main` (clean fast-forward,
  no overlapping-file revert risk, no possible merge conflict).
- Local `main` exactly equalled `origin/main`.
- No open PR for the branch, no in-progress rebase/merge.

Uncommitted items handled deliberately:
- `apps/meerkat/docs/plans/meerkat-consumer-front-door-decomposition-2026-06-22.md` (untracked,
  real 107-line Meerkat decomposition map) -> committed as `docs(meerkat): add consumer front-door
  decomposition map`.
- `.gitignore` (adds `.superpowers/` scratch ignore) -> committed as `chore: gitignore superpowers
  scratch dir`.
- `memory.md` (3 stop-hook auto-rows) -> deliberately NOT landed to main; overwritten with a proper
  session row on the new branch.

Branch then 17 ahead / 0 behind.

Verification before push (all green):
- `pnpm typecheck`: 122/122 tasks
- `pnpm test`: exit 0, 121 turbo tasks (web 376 passed / 4 skipped)
- `pnpm check:parity`: green, incl. Meerkat parity + 52 module layouts consistent
- `pnpm check:generated-artifacts`: green

Land (fast-forward, no local checkout of main so the dirty `memory.md` stayed untouched):
- `git push origin feature/meerkat-prompt01-ia:main` -> `dea99f89..4c8018cb`
- `git branch -f main feature/meerkat-prompt01-ia` (sync local main)
- `git push -u origin feature/meerkat-prompt01-ia` (preserve branch on origin)
- Verified: `origin/main` = local `main` = branch tip = `4c8018cb`, divergence `0 0`.

Landed contents: Meerkat Prompts 01-11 (user-first IA, onboarding, audience rules, posts/threads,
local feed engine, friends/messages, community safety, hosted boundaries, profiles/pseudonyms,
polish/readiness, mobile-web nav + friendly `MKPAIR1` pairing codes), WEB-FIX-1 (@mylife/ui
RN-barrel 500 fix), the NYC power-user web eval + sprint plan + handoff prompt, and the 2
housekeeping commits.

### 2. Cut the improvement-sprint branch

`feature/mylife-improvements-sprints` off `main` (`4c8018cb`). This runs the 10-ticket plan in
`docs/reports/PLAN-mylife-web-nyc-daily-driver-sprint-2026-06-24.html`, reframed per user direction
as general MyLife improvements done in full (the NYC daily-driver profile is the lens, not the scope
limit). Sports to be unhidden in full (all tabs incl. scores/stats), not trimmed.

## Sprint plan structure (orchestration)

Orchestrator stays ultracode; every implementer and reviewer is a plain Opus subagent. Per ticket:
read diff -> `gate:function:changed` + `--filter web typecheck` + `check:parity` -> boot web dev,
probe route 200 + exercise acceptance live -> /review + /browse -> adversarial Opus reviewer where
required -> one Conventional Commit. Sprints run strictly 1 -> 2 -> 3 with a live re-verify + re-score
barrier between each.

## Files changed (this session, on the new branch so far)
- `memory.md` (Project State + Sessions row)
- `docs/sessions/2026-06-25-meerkat-land-and-sprint-kickoff.md` (this log)
- (on the branch before land) `apps/meerkat/docs/plans/meerkat-consumer-front-door-decomposition-2026-06-22.md`, `.gitignore`

## Remaining
- Sprint 1: WEB-FIX-2, MOD-UNHIDE, CLS-SEMESTER, UI-HARDEN.
- Then re-score barrier, Sprint 2 (REMIND-INTAB -> MEDS-SUPP, DN-NU-JOIN), Sprint 3 (MANH-WEB, SYNC-REAL).
- Founder-ops blockers to surface as hit: SeatGeek proxy/client-id (MANH-WEB), real two-device QA (SYNC-REAL).
