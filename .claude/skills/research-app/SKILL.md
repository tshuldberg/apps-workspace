---
name: research-app
description: Analyze an app codebase and generate a structured research report with architecture, dependencies, features, patterns, and recommendations
argument-hint: [project-path-or-name]
allowed-tools: Read, Write, Glob, Grep, Bash(ls:*), Bash(wc:*), Bash(git:*), Bash(du:*), Bash(node:*), Bash(python3:*), Bash(cat:*), Bash(tree:*)
---

# Research App — Codebase Analysis Skill

You are a specialized app researcher. Analyze the target application and produce a comprehensive research report.

## Input

`$ARGUMENTS` — Project path (relative to `/Apps/` or absolute) or project name matching a key in the root CLAUDE.md.

## Step 1: Resolve the Project

1. If `$ARGUMENTS` is a short name (e.g., `receipts`, `macos-hub`, `tron-castle-fight`), resolve it:
   - Read `/Users/trey/Desktop/Apps/CLAUDE.md` and find the matching project entry
   - Known mappings: `EasyStreet` → `Parks/EasyStreet`, `easystreet-monorepo` → `Parks/easystreet-monorepo`, `shiphawk-dev` → `SH/shiphawk-dev`
   - All others are at `/Users/trey/Desktop/Apps/<name>/`
2. If `$ARGUMENTS` is a relative path, prepend `/Users/trey/Desktop/Apps/`
3. If `$ARGUMENTS` is an absolute path, use as-is
4. Verify the directory exists with `ls`

## Step 2: Read Existing Documentation

Check for and read each of these (note which are missing):
- `CLAUDE.md` (project root) or `.claude/CLAUDE.md`
- `README.md`
- `timeline.md` or `PROJECT_LOG.md`
- `AGENTS.md`
- `.claude/docs/` directory contents
- `.claude/skills/SKILLS_REGISTRY.md`
- `package.json`, `Gemfile`, `pyproject.toml`, `Podfile`, `build.gradle.kts`, `Cargo.toml` (whichever exist)

Extract key information from each file found.

## Step 3: Analyze Codebase Structure

Run these analyses:
1. **Directory overview:** `ls -la` on project root
2. **File counts by type:** Use `Glob` to count files by extension (`.ts`, `.js`, `.py`, `.swift`, `.kt`, `.html`, `.css`, `.json`, `.md`)
3. **Directory tree:** Map 2-3 levels deep using `ls` or `tree` (if available)
4. **Total size:** `du -sh` on the project (exclude `node_modules/`, `.git/`, `dist/`, `build/`)
5. **Primary language(s):** Determine from file extension distribution
6. **Source vs config vs docs:** Categorize top-level directories

## Step 4: Analyze Dependencies

Based on the dependency file found in Step 2:
- **package.json:** Extract `dependencies` and `devDependencies` with versions
- **Gemfile:** Extract gems with version constraints
- **pyproject.toml / requirements.txt:** Extract Python packages
- **Podfile:** Extract iOS pods
- **build.gradle.kts:** Extract Android dependencies
- Note the package manager (npm, bun, yarn, poetry, bundler, pip, cocoapods, gradle)
- Flag any notably outdated or deprecated dependencies

## Step 5: Analyze Architecture

1. **Design patterns:** Identify from directory structure and code organization (MVC, MVVM, service objects, repository pattern, etc.)
2. **Key components:** For each major directory, determine its purpose and approximate size
3. **API framework:** REST, GraphQL, gRPC, WebSocket, etc.
4. **Database:** Type and ORM used
5. **Background jobs:** Queue system if any
6. **State management:** Frontend state approach
7. **Testing infrastructure:** Test framework, test file locations, approximate test coverage

For each key component, note:
| Component | Location | Purpose | Size (files/lines) |

## Step 6: Analyze Git History

Run these git commands (skip if not a git repo):
1. `git -C <path> log --oneline | wc -l` — total commits
2. `git -C <path> log --format="%ai" --reverse | head -1` — first commit date
3. `git -C <path> log --format="%ai" -1` — last commit date
4. `git -C <path> log --oneline -10` — recent commits
5. `git -C <path> shortlog -sn --no-merges | head -10` — top contributors
6. `git -C <path> branch -a | head -20` — branches

## Step 7: Feature Inventory

This is the **most important section**. Build a comprehensive feature list:

1. **Read route files** (urls.py, routes.tsx, router files) to map all endpoints/pages
2. **Read model/schema files** to understand data entities
3. **Read view/controller files** to understand business operations
4. **For each feature, document:**
   - Feature name
   - User-facing description
   - Key files involved
   - API endpoints (if applicable)
   - Status (complete, partial, planned)

Group features into categories (Auth, Core, Admin, Infrastructure, etc.).

## Step 8: Assess Documentation Quality

Score against the workspace CLAUDE.md Quality Tiers:

**Tier 1 (Minimum):** Overview, Stack, Key Commands, Architecture, Git Workflow
**Tier 2 (Standard):** Tier 1 + Testing, Code Style, Environment Setup, Important Notes, change tracking
**Tier 3 (Mature):** Tier 2 + `.claude/docs/`, custom skills, plugin inventory, development tracking rules

For each section, note: Present (Y/N), Quality (Good/Fair/Poor), and specific gaps.

## Step 9: Identify Gaps and Recommendations

Analyze what's missing or could be improved:
- Missing documentation
- Missing tests or low test coverage
- Missing CI/CD configuration
- Opportunities for Claude Code skills
- Cross-project dependencies to document
- Security considerations
- Performance considerations
- Architectural improvements

Categorize recommendations as:
- **Immediate** — Should be addressed now (blocking issues, security concerns)
- **Short-Term** — Should be addressed within the next few sessions
- **Long-Term** — Nice to have, architectural improvements

## Step 10: Write the Report

Generate the report using the template at [report-template.md](report-template.md).

**Save the report to:** `/Users/trey/Desktop/Apps/docs/reports/<project-name>-research-<date>.md`
where `<date>` is today's date in `YYYY-MM-DD` format.

## Output

After saving the report, present a summary to the user:
```
Research complete: <project-name>
Report saved: /Users/trey/Desktop/Apps/docs/reports/<project-name>-research-<date>.md

Key findings:
- [3-5 bullet points of the most important discoveries]

Recommendations:
- [Top 3 actionable recommendations]
```

## Quality Standards

- Reference absolute file paths for all mentioned files
- Include quantitative data (line counts, file counts, dependency counts)
- Distinguish between facts (observed) and recommendations (opinion)
- Be thorough but concise — the report should be comprehensive without being padded
- If you can't determine something, say so explicitly rather than guessing
