# Commit Commands Plugin — User Guide

**Category:** Plugin
**Scope:** Project-scoped (installed per-project via `.claude/settings.json`)
**Projects using this:** receipts, EasyStreet (native), easystreet-monorepo
**Last updated:** 2026-02-08

## What It Does

The commit-commands plugin provides three git workflow commands that streamline the commit-to-PR process. It analyzes your changes, drafts commit messages matching your repository's style, and can create branches and pull requests in one step.

## Setup

### Prerequisites
- Claude Code CLI installed
- Git repository initialized
- `gh` CLI installed and authenticated (for `/commit-push-pr`)

### Installation

```bash
claude plugin install commit-commands@claude-plugins-official
```

### Configuration

Enable in project settings (`.claude/settings.json`):
```json
{
  "enabledPlugins": ["commit-commands@claude-plugins-official"]
}
```

## Usage

### Quick Start

1. Make your code changes
2. Type `/commit` to stage and commit with an auto-generated message
3. Or type `/commit-push-pr` to commit, push, and create a PR in one step

### Commands

| Command | What It Does |
|---------|--------------|
| `/commit` | Analyzes staged/unstaged changes, drafts a commit message matching repo style, stages relevant files, and commits |
| `/commit-push-pr` | Creates a branch (if on main), commits, pushes, and creates a PR via `gh pr create` |
| `/clean_gone` | Removes local branches marked as `[gone]` (deleted on remote) and their associated worktrees |

### Common Operations

| Operation | Command | Notes |
|-----------|---------|-------|
| Simple commit | `/commit` | Auto-detects changes and generates message |
| Commit with hint | `/commit fix the login bug` | Uses your hint to guide the commit message |
| Full PR workflow | `/commit-push-pr` | Creates branch, commits, pushes, opens PR |
| Clean stale branches | `/clean_gone` | Removes branches deleted on remote |

### How `/commit` Works

1. Runs `git status` to identify changed files
2. Runs `git diff` to analyze the nature of changes
3. Reads recent `git log` to match the repository's commit message style
4. Drafts a concise commit message (follows project conventions — Conventional Commits, Jira-linked, etc.)
5. Stages the relevant files
6. Creates the commit

### How `/commit-push-pr` Works

1. Checks if you're on `main`/`master` — if so, creates a feature branch
2. Performs the same commit flow as `/commit`
3. Pushes the branch to the remote with `-u` flag
4. Creates a PR via `gh pr create` with:
   - Auto-generated title from the commit
   - Description summarizing the changes
   - Test plan section

### How `/clean_gone` Works

1. Lists local branches tracking remote branches
2. Identifies branches where the remote is marked `[gone]` (deleted after merge)
3. Removes those local branches
4. If any associated worktrees exist, removes them too

### Advanced Usage

**Project-specific commit styles:** The plugin reads your recent git log to match conventions. It respects:
- Conventional Commits (`feat:`, `fix:`, `refactor:`) — used by receipts
- Jira-linked commits (`[DEV-12345] description`) — used by shiphawk-dev
- Feature-prefix branches (`feature/`, `fix/`) — used by receipts, EasyStreet

**Worktree awareness:** `/clean_gone` is worktree-aware. If a stale branch has a worktree checked out, it handles removal of both the branch and the worktree directory.

## Integration with Other Tools

- **superpowers plugin:** Use superpowers for implementation workflow, then `/commit` when done
- **code-review plugin:** After `/commit-push-pr` creates a PR, run `/code-review` for automated review
- **Git worktrees:** `/clean_gone` is especially useful when working with worktrees — it cleans up both branches and worktree directories after PRs are merged

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `/commit-push-pr` fails on PR creation | Ensure `gh` CLI is installed and authenticated: `gh auth status` |
| Commit message doesn't match project style | The plugin reads recent `git log`; ensure your repo has enough commit history |
| `/clean_gone` removes unexpected branches | Only removes branches where remote tracking shows `[gone]`; verify with `git branch -vv` first |
| Plugin not found | Run `claude plugin install commit-commands@claude-plugins-official` |

## References

- **Marketplace:** `claude-plugins-official`
- **Git workflow docs:** See each project's CLAUDE.md for project-specific git conventions
- **GitHub CLI:** [cli.github.com](https://cli.github.com) — required for `/commit-push-pr`
