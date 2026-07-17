# Receipts: Remove PR & Worktree Rules

**Date:** 2026-02-12
**Scope:** `/Users/trey/Desktop/Apps/receipts/` + workspace CLAUDE.md
**Status:** Recommended, pending approval

## Why

The project currently enforces two workflow patterns that are no longer desired:

1. **Pull Requests** — All changes to `main` must go through PRs with squash merge. This was set up during the early code review standards pass (2026-02-04) when the project anticipated multi-contributor review workflows. For a solo developer using Claude Code agents, PRs add friction without adding value — there's no second human reviewer to gate the merge.

2. **Git Worktrees** — Parallel working directories for branch isolation. Worktree documentation was recently extracted into its own reference doc (`.claude/docs/git-worktrees.md`) during the CLAUDE.md optimization. The project used worktrees for parallel agent work, but the complexity of managing multiple working directories, port allocations, and per-worktree dependency installs outweighs the benefit when Claude Code agents can work on one branch at a time.

Removing these rules simplifies the git workflow to: branch, commit directly to `main`, done.

## What Changes

### Active Instruction Files (6 files, ~11 edits)

#### 1. `CLAUDE.md` — 4 changes

| Line | Current | Recommended |
|------|---------|-------------|
| 9 | `@.claude/docs/git-worktrees.md` | Remove entire line |
| 62 | `Squash merge to \`main\` via PR only. No direct push. Delete branch after merge.` | Rewrite: `Commit directly to \`main\`. Delete feature branches after merge.` |
| 64 | `Worktrees: See \`@.claude/docs/git-worktrees.md\`. Ports: main=5173/8000, worktree+1 per additional.` | Remove entire line |
| 83 | Skill table row: `Start feature work needing branch isolation → superpowers:using-git-worktrees` | Remove entire row |

**Why:** CLAUDE.md is the primary instruction file loaded every session. These 4 references actively instruct Claude to use PRs and worktrees. Removing them stops Claude from creating PRs or suggesting worktree workflows.

#### 2. `AGENTS.md` — 1 change

| Line | Current | Recommended |
|------|---------|-------------|
| 23 | `- /Users/trey/.../git-worktrees.md` | Remove entire line |

**Why:** AGENTS.md mirrors CLAUDE.md references. The Instruction Sync rule requires both files to stay aligned.

#### 3. `.claude/docs/git-worktrees.md` — Delete entire file

**Why:** This 78-line reference doc was just created during today's CLAUDE.md optimization. It has no historical value and no other file depends on it (once the @-reference is removed from CLAUDE.md).

#### 4. `.claude/docs/plugins.md` — 3 changes

| Line | Current | Recommended |
|------|---------|-------------|
| 41 | `/commit-push-pr` command row: `Creates branch, commits, pushes, creates PR via gh pr create` | Remove entire row |
| 42 | `/clean_gone` row mentions: `and their associated worktrees` | Rewrite: `Removes local branches marked as [gone]` |
| 89 | Superpowers skill row: `superpowers:using-git-worktrees → Creates isolated git worktrees` | Remove entire row |

**Why:** plugins.md documents available tools. Keeping `/commit-push-pr` listed encourages agents to use it. The `/clean_gone` command is still useful for branch cleanup but shouldn't reference worktrees. The worktree skill row is no longer relevant.

#### 5. `.claude/skills/resume-session/SKILL.md` — 1 change

| Line | Current | Recommended |
|------|---------|-------------|
| 59 | `3. **PR review feedback** — check for open PRs with \`gh pr list --state open\`` | Remove this step, renumber remaining items |

**Why:** The `/resume-session` skill runs at the start of every session. If it checks for open PRs, it reinforces the PR workflow and may surface stale PRs from before the workflow change.

#### 6. Workspace `CLAUDE.md` (`/Users/trey/Desktop/Apps/CLAUDE.md`) — 1 change

| Line | Current | Recommended |
|------|---------|-------------|
| 154 | `Conventional Commits, squash merge to \`main\`, branch naming... Supports git worktrees for parallel development.` | Rewrite: `Conventional Commits, direct commit to \`main\`, branch naming \`feature/\`, \`fix/\`, \`refactor/\`, \`docs/\`.` |

**Why:** The workspace CLAUDE.md provides project summaries visible to all sessions across all projects. The receipts entry should reflect the actual workflow.

### Historical Files — Do NOT Modify

These files record what actually happened and should remain unchanged:

| File | PR/Worktree References | Why Keep |
|------|----------------------|----------|
| `note-taker.md` | ~15 | Session history — documents squash merges, PR reviews, and decisions made |
| `timeline.md` | ~20 | Change log — records PR #1 closure, PR #2 merge, PR #30 CI fix, etc. |
| `docs/archive/*` | ~10 | Archived plans and engineering org docs |
| `docs/plans/*` | ~8 | Historical sprint plans that reference PR workflows |

Modifying historical docs would erase institutional memory. The PR and worktree references in these files are factual records of past work, not active instructions.

## New Git Workflow (After Changes)

```
- Branches: codex/<desc> (agent), feature/, fix/, refactor/, docs/ (manual)
- Commits: Conventional Commits. No "wip"/"update" messages.
- Merge: Commit directly to main. Delete feature branches after merge.
```

No PRs. No worktrees. No squash merge ceremony. Branch, work, commit to main, clean up.
