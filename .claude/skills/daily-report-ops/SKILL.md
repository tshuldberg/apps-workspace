---
name: daily-report-ops
description: Generate daily or ad-hoc project/workspace reports with strict filename conventions (project + date), and triage stale/conflicting PRs (merge clean, close superseded, recreate via cherry-pick). Use when asked for daily reports, workspace summaries, or to clean up PR backlogs like conflicting docs PRs.
---

# Daily Report Ops

## Overview
Create readable daily reports and resolve stale/conflicting PRs with a repeatable workflow. Emphasize clear filenames that include project and date so files are identifiable from any folder.

## Naming Convention (Required)
Use this filename pattern everywhere unless the user explicitly requests otherwise:

- `REPORT-<project>-YYYY-MM-DD.md`

Rules:
- `project` is a short, lowercase slug (examples: `workspace`, `receipts`, `macos-hub`, `easystreet-native`, `easystreet-monorepo`, `tron-castle-fight`, `shiphawk-templates`).
- `YYYY-MM-DD` is the report date.
- Always include the project slug in the filename for readability from any folder.

Default locations:
- Workspace reports: `/Users/trey/Desktop/Apps/docs/reports/REPORT-workspace-YYYY-MM-DD.md`
- Project reports: `<project-root>/docs/reports/REPORT-<project>-YYYY-MM-DD.md` if the folder exists, otherwise `<project-root>/REPORT-<project>-YYYY-MM-DD.md`.
- If the user asks for a root duplicate, also create `/Users/trey/Desktop/Apps/DAILY-REPORT-<project>-YYYY-MM-DD.md` and optionally `/Users/trey/Desktop/Apps/DAILY-REPORT.md` if explicitly requested.

## Workflow

### 1) Report Collection
1. Determine scope (workspace vs specific project) and the date window.
2. Collect activity:
   - `git log --since="<start>"` for commits and merges.
   - Timeline files (`timeline.md`, `PROJECT_LOG.md`) for narrative context.
3. Summarize in plain language (concise, minimal jargon).
4. List completed PRs with numbers and merge commits when available.

### 2) Report Structure (Recommended)
- Executive summary (counts, key wins, blockers)
- PRs completed (table)
- Repo-by-repo summary
- Risks / gaps / blockers
- Next focus areas

### 3) PR Triage Rules
Check each open PR for mergeability and scope using `gh pr view` and branch divergence.

Decision rules:
1. **Clean and mergeable** (`mergeable=MERGEABLE`, `mergeStateStatus=CLEAN`): merge with `--merge` and delete the branch.
2. **Conflicting and superseded** (large consolidation, stale, or already covered by newer PRs): close with a comment explaining it is superseded and conflicting.
3. **Conflicting but small, still relevant** (often docs-only, 1-3 commits):
   - Create a new branch from `origin/main`.
   - Cherry-pick the commit(s).
   - Push and open a replacement PR.
   - Close the original PR and link the replacement.
4. **Unclear or risky**: stop and ask the user which direction to take.

Suggested commands (examples):
```bash
# Inspect PR status
for n in <PRS>; do gh pr view "$n" --json number,title,state,mergeable,mergeStateStatus,headRefName,baseRefName; done

# Recreate a conflicting docs PR
git fetch origin --prune
git switch -c codex/prX-refresh origin/main
git cherry-pick <commit>
git push -u origin codex/prX-refresh
# Open new PR and close old one with a comment
```

### 4) Guardrails
- Do not touch `.claude/settings.json` unless explicitly requested.
- Always exclude `/Users/trey/Desktop/Apps/SH/shiphawk-dev` unless explicitly in scope.
- If network/API access fails, state the limitation and proceed with local evidence only.

## Output Checklist
- Report file written using the naming convention.
- If requested, root duplicate created.
- PR actions documented (merged/closed/replaced) with links or commit IDs.
