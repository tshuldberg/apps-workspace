# Workspace Cleanup — Next Steps

**Date:** 2026-02-08
**Scope:** Full /Apps workspace audit (excluding shiphawk-dev per scope guardrail)

---

## Audit Summary

| Project | Worktree | Branch | Open PRs | Remote | Action Needed |
|---------|----------|--------|----------|--------|---------------|
| **/Apps** (root) | 1 untracked file | main | 0 | Yes | Commit report |
| **macos-hub** | Clean | main + 1 stale branch | 0 | Yes | Delete stale branch |
| **EasyStreet (native)** | Clean | main | 1 open PR | Yes | Review/merge PR #6 |
| **easystreet-monorepo** | **DIRTY** (15 modified, 4 untracked) | main | 0 | Yes | Commit or stash work |
| **receipts** | Clean (2 untracked artifacts) | codex/pr7 (not main!) | **10 open PRs** | Yes | Triage PRs, switch to main |
| **shiphawk-templates** | Clean | master | 0 | Yes | None |
| **tron-castle-fight** | **DIRTY** (5 modified, 12 untracked) | main | 0 | **None** | Create remote, commit all work |
| **SH/automation-hub** | Part of /Apps root | — | — | — | Not a separate repo |

---

## Priority 1: Dirty Worktrees (Uncommitted Work at Risk)

### 1.1 — tron-castle-fight: Commit all work + create remote

**Status:** 5 modified files, 12 untracked files/directories. No remote. Only 2 commits total.

**Uncommitted work includes:**
- Entire multiplayer system (`server/`, `online-game.js`, `online.html`, `package.json`)
- Project governance files (`AGENTS.md`, `CLAUDE.md`, `PROJECT_LOG.md`, `project-governance/`, `skills/`)
- Scripts directory (`scripts/`)
- Responsive menu feature (`responsive-menu.js`)
- Core file updates (`game.js`, `index.html`, `styles.css`, `.gitignore`, `README.md`)

**Actions:**
- [ ] `cd tron-castle-fight && git add -A && git commit` — Commit all outstanding work
- [ ] Create GitHub repo: `gh repo create tshuldberg/tron-castle-fight --private --source=. --remote=origin --push`
- [ ] Verify push succeeded

### 1.2 — easystreet-monorepo: Commit all work

**Status:** 15 modified files, 4 untracked files/dirs. Only 1 commit ever (initial scaffold). Significant in-progress feature work.

**Uncommitted work spans:**
- Mobile app (7 modified components/hooks, 1 new component, 2 new directories: `data/`, `services/`)
- Backend (3 Convex files: `parking.ts`, `preferences.ts`, `schema.ts`)
- Shared package (`constants.ts`, `index.ts`)
- Docs (`easystreet-app-comparison.md`)

**Actions:**
- [ ] Review changes: `cd Parks/easystreet-monorepo && git diff --stat`
- [ ] Stage and commit: `git add -A && git commit -m "feat: mobile app features, backend updates, and shared constants"`
- [ ] Consider creating a feature branch + PR if changes are not ready for main
- [ ] Push to remote

---

## Priority 2: Open PRs Requiring Triage

### 2.1 — receipts: 10 open PRs need triage

**Current state:** Checked out on `codex/pr7-ci-workflows-pr-template` (not main). All 10 PRs are open as of 2026-02-08.

| PR # | Title | Branch | Type |
|------|-------|--------|------|
| 25 | ci: add GitHub workflows and pull request template | `codex/pr7-ci-workflows-pr-template` | CI/CD |
| 24 | feat(frontend): moderation queue/report flows, legal routes, expanded tests | `codex/pr6-frontend-moderation-legal-tests` | Feature |
| 23 | feat(backend): moderation app, auth/email infra, serializer hardening | `codex/pr5-backend-moderation-auth-infra` | Feature |
| 22 | chore: ignore local generated Playwright/output artifacts | `codex/pr4-ignore-generated-artifacts` | Chore |
| 21 | docs: consolidated algorithm-profile dossiers | `codex/pr3-algorithm-profiles-consolidated-docs` | Docs |
| 20 | docs: filter overhaul design specs and launch trackers | `codex/pr1-planning-and-filter-overhaul-docs` | Docs |
| 19 | feat: moderation/reporting backend+frontend, legal routes, CI | `codex/pr2-app-quality-and-moderation-updates` | Feature |
| 18 | docs: Update timeline, note-taker patterns, product features | `docs/tracking-updates` | Docs |
| 17 | docs: Add skill usage guide, new skills, fix paths | `docs/claude-code-skills` | Docs |
| 16 | Merge 5.3-main branch consolidation into main | `5.3-main` | Consolidation |

**Actions:**
- [ ] Decide merge order — PR #16 (`5.3-main` consolidation) is likely the base that others build on
- [ ] Check for merge conflicts between PRs (especially `codex/pr2` vs `codex/pr5`+`codex/pr6` which overlap in scope)
- [ ] Merge or close overlapping PRs (PR #19 `codex/pr2` appears to overlap with PRs #23-25)
- [ ] Switch local checkout back to `main` after triage: `git checkout main`
- [ ] Clean up untracked artifacts (`.playwright-cli/`, `output/`) — add to `.gitignore` or delete

### 2.2 — EasyStreet (native): 1 open PR

| PR # | Title | Branch | Type |
|------|-------|--------|------|
| 6 | docs: email-to-task CLI implementation plan | `docs/email-to-task-plan` | Docs |

**Actions:**
- [ ] Review and merge PR #6, or close if no longer relevant
- [ ] Delete remote branch `docs/email-to-task-plan` after resolution

---

## Priority 3: Stale Branches

### 3.1 — macos-hub: Delete merged branch

**Branch:** `feature/timeline-and-agent-docs` (merged via PR #1)

**Actions:**
- [ ] `cd macos-hub && git branch -d feature/timeline-and-agent-docs`
- [ ] `git push origin --delete feature/timeline-and-agent-docs` (if remote still exists)

---

## Priority 4: Root /Apps Workspace

### 4.1 — Commit untracked report

**File:** `docs/reports/commit-pr-policy-review-2026-02-08.md` (1,049 lines, comprehensive policy review)

**Actions:**
- [ ] `git add docs/reports/commit-pr-policy-review-2026-02-08.md`
- [ ] `git commit -m "docs: add commit/PR policy review report"`
- [ ] `git push`

---

## Non-Issues (Verified Clean)

- **shiphawk-templates** — Fully clean, single branch (`master`), synced with remote, no PRs.
- **SH/automation-hub** — Not its own repo; part of the /Apps root workspace. Clean.
- **shiphawk-dev** — Excluded per scope guardrail.

---

## Summary of Required Actions

| # | Action | Project | Urgency |
|---|--------|---------|---------|
| 1 | Commit all uncommitted work | tron-castle-fight | High (data loss risk) |
| 2 | Create GitHub remote + push | tron-castle-fight | High (no backup) |
| 3 | Commit all uncommitted work | easystreet-monorepo | High (data loss risk) |
| 4 | Triage 10 open PRs | receipts | Medium |
| 5 | Switch local checkout to main | receipts | Low |
| 6 | Review/merge PR #6 | EasyStreet (native) | Low |
| 7 | Delete stale merged branch | macos-hub | Low |
| 8 | Commit untracked report | /Apps root | Low |

---

## Success Criteria

This cleanup is complete when all of the following are true:

1. **Zero dirty worktrees** — Every project's `git status` shows clean (no modified, staged, or untracked files outside `.gitignore`)
2. **All projects have a remote** — Every repo is pushed to GitHub with `main`/`master` up to date
3. **No stale branches** — Merged branches deleted locally and on remote
4. **All open PRs resolved** — Each PR is either merged, closed with reason, or marked draft with a documented follow-up date
5. **All local checkouts on default branch** — No project left checked out on a feature/topic branch
6. **Root /Apps workspace clean** — All workspace-level files committed and pushed

### Verification Command

Run from `/Apps/` to spot-check all repos:
```bash
for dir in macos-hub Parks/EasyStreet Parks/easystreet-monorepo receipts shiphawk-templates tron-castle-fight; do
  echo "=== $dir ===" && git -C "$dir" status --short && echo
done
```

Expected output: empty status for every project.

---

*Generated by workspace audit — 2026-02-08*
