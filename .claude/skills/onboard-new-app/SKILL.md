---
name: onboard-new-app
description: Onboard a new application into the /Apps workspace — generates CLAUDE.md, timeline.md, updates root index, and runs initial research
argument-hint: [project-path]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(git:*), Bash(wc:*), Bash(du:*), Bash(mkdir:*), Bash(tree:*), Skill
---

# Onboard New App — Workspace Integration Skill

You are onboarding a new application into the `/Apps/` workspace. Follow these steps to set up documentation, integrate with the workspace index, and run initial research.

## Input

`$ARGUMENTS` — Project path (relative to `/Apps/` or absolute). The project directory must already exist.

## Step 1: Resolve and Verify the Project

1. If `$ARGUMENTS` is a relative path, prepend `/Users/trey/Desktop/Apps/`
2. If `$ARGUMENTS` is an absolute path, use as-is
3. Verify the directory exists with `ls`
4. If it doesn't exist, stop and tell the user

Determine the **project name** (the final directory component, e.g., `my-app`) and the **display name** (a human-readable version for headings).

## Step 2: Determine Placement

Check where the project sits relative to `/Apps/`:

- **Root level:** `/Apps/<project-name>/` — standalone project
- **Group level:** `/Apps/<Group>/<project-name>/` — part of a project group (e.g., `Parks/`, `SH/`)
- **Deeply nested:** flag as unusual and confirm with the user

Validate the directory name follows conventions (lowercase-with-hyphens). If it doesn't, warn the user but proceed.

## Step 3: Check Git Repository Status

```bash
git -C <project-path> rev-parse --is-inside-work-tree
```

- If **not a git repo**: note this in findings, suggest initialization
- If **is a git repo**: record this and proceed (git history will be analyzed by `/research-app`)

## Step 4: Audit Existing Documentation

Check for each of these files and record what exists vs what's missing:

| File | Check Locations |
|------|----------------|
| CLAUDE.md | `<root>/CLAUDE.md`, `<root>/.claude/CLAUDE.md` |
| README.md | `<root>/README.md` |
| timeline.md | `<root>/timeline.md` |
| PROJECT_LOG.md | `<root>/PROJECT_LOG.md` |
| AGENTS.md | `<root>/AGENTS.md` |
| .claude/skills/ | `<root>/.claude/skills/` |
| .claude/docs/ | `<root>/.claude/docs/` |

Also check for dependency files: `package.json`, `Gemfile`, `pyproject.toml`, `Podfile`, `build.gradle.kts`, `Cargo.toml`, `go.mod`, `Cargo.toml`.

## Step 5: Generate Missing Documentation

### 5a: CLAUDE.md (if missing)

If no CLAUDE.md exists, generate one from the Tier 1 template.

1. Read the project's dependency file, README, and source structure to determine:
   - What the project does (overview)
   - Stack (languages, frameworks)
   - Key commands (build, test, lint, run)
   - Architecture (directory structure, patterns)
   - Git workflow (if determinable from history)

2. Read the Tier 1 template: `/Users/trey/Desktop/Apps/docs/templates/claude-md-minimum.md`

3. Write the CLAUDE.md to the project root: `<project-path>/CLAUDE.md`

4. If the project is complex enough for Tier 2, read `/Users/trey/Desktop/Apps/docs/templates/claude-md-standard.md` and include additional sections.

### 5b: timeline.md (if missing and no PROJECT_LOG.md exists)

Create an initial `timeline.md` at `<project-path>/timeline.md`:

```markdown
# <Display Name> Timeline

Tracks development sessions and changes.

---

## <today's date> — Project Onboarded to /Apps Workspace

**Session:** Initial onboarding via `/onboard-new-app` skill

### Actions
- **Onboarded** project into `/Apps/` workspace
- **Created** `timeline.md` — this file
- [Add any other created files]

### Notes
- Project path: `<project-path>`
- [Add any relevant context]
```

### 5c: README.md (if missing)

Create a minimal README.md:

```markdown
# <Display Name>

[Brief description based on code analysis]

## Setup

[Prerequisites and installation steps]

## Usage

[How to run the project]
```

## Step 6: Update Root CLAUDE.md

Read `/Users/trey/Desktop/Apps/CLAUDE.md` and add a new project entry under `## Projects`.

Follow the existing format exactly:

```markdown
### <project-name> — <Short Description>
<1-2 sentence description>. [Has its own CLAUDE.md.]

**Stack:** [list]

**Key commands:**
\```bash
[build/test/run commands]
\```

**Architecture:** [summary]
```

Insert the new entry alphabetically among existing project entries (but always after the Scope Guardrail section for shiphawk-dev).

Also update the `## Cross-Project Patterns` section if the new project:
- Maintains a timeline.md → add to the timeline tracking bullet
- Has its own CLAUDE.md → add to the project-level CLAUDE.md bullet
- Has relationships with existing projects → document them

## Step 7: Run Initial Research

Invoke the `/research-app` skill on the project:

```
/research-app <project-path>
```

This generates a comprehensive research report saved to `/Apps/docs/reports/`.

## Step 8: Update Workspace Timeline

Read `/Users/trey/Desktop/Apps/timeline.md` and append a new entry:

```markdown
## <today's date> — Onboarded <Display Name>

**Session:** New app onboarding via `/onboard-new-app` skill

### Actions
- **Onboarded** `<project-name>` at `<project-path>`
- **Created** [list files created: CLAUDE.md, timeline.md, README.md]
- **Updated** `/Apps/CLAUDE.md` — Added project entry under Projects section
- **Generated** research report at `/Apps/docs/reports/<project-name>-research-<date>.md`

### Notes
- Stack: [brief stack summary]
- Documentation tier: [Tier 1/2/3]
```

## Step 9: Update Documentation Index

Read `/Users/trey/Desktop/Apps/docs/README.md` and add the new research report to the reports inventory table.

## Output

Present a summary to the user:

```
Onboarding complete: <project-name>
Location: <project-path>

Created:
- [list of files created]

Updated:
- /Apps/CLAUDE.md — added project entry
- /Apps/timeline.md — added onboarding entry
- /Apps/docs/README.md — added research report to index

Research report: /Apps/docs/reports/<project-name>-research-<date>.md

Project documentation tier: [Tier 1/2/3]
Recommendations: [top 2-3 from research report]
```

## Quality Standards

- Verify all written files are well-formed markdown
- Ensure CLAUDE.md follows workspace minimum section requirements (Overview, Stack, Key Commands, Architecture, Git Workflow)
- Use absolute paths in the root CLAUDE.md project entry
- Match the formatting style of existing project entries exactly
- If any step fails, report the failure clearly and continue with remaining steps
