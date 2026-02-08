I now have a thorough understanding of the entire workspace. Let me compile the comprehensive implementation plan.

---

# /Apps Workspace Standards and Infrastructure Implementation Plan

## Solutions Engineering and Developer Specialist Report

**Date:** 2026-02-08
**Scope:** Multi-project workspace at `/Users/trey/Desktop/Apps`
**Author:** Solutions Engineering Specialist Agent
**Status:** Research complete, implementation plan ready

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Workspace Standards Framework](#2-workspace-standards-framework)
3. [Plugin/Tool User Guides Framework](#3-plugintool-user-guides-framework)
4. [App Research Skill Design](#4-app-research-skill-design)
5. [Documentation Architecture](#5-documentation-architecture)
6. [Future App Onboarding Process](#6-future-app-onboarding-process)
7. [Implementation Phases](#7-implementation-phases)

---

## 1. Current State Analysis

### 1.1 Workspace Inventory

The `/Users/trey/Desktop/Apps/` workspace contains the following active projects, organized in a flat-with-grouping structure:

| Project | Location | CLAUDE.md | timeline.md | Skills | Maturity |
|---------|----------|-----------|-------------|--------|----------|
| macos-hub | `/Apps/macos-hub/` | Yes (root) | No | No | Medium |
| EasyStreet (native) | `/Apps/Parks/EasyStreet/` | Yes (`.claude/CLAUDE.md`) | Yes | No (uses plugins) | High |
| easystreet-monorepo | `/Apps/Parks/easystreet-monorepo/` | Yes (`.claude/CLAUDE.md`) | Yes | No (uses plugins) | Medium |
| receipts (Receeps) | `/Apps/receipts/` | Yes (root) | Yes | Yes (5 custom) | Very High |
| shiphawk-templates | `/Apps/shiphawk-templates/` | Yes (root) | Yes | No | Medium |
| tron-castle-fight | `/Apps/tron-castle-fight/` | Yes (root) | No (uses PROJECT_LOG.md) | Yes (1 custom) | Medium |
| shiphawk-dev | `/Apps/SH/shiphawk-dev/` | Covered in root | No | Unknown | Excluded |
| automation-hub | `/Apps/SH/automation-hub/` | No | No | No | Early |

### 1.2 Observed Pattern Divergences

**CLAUDE.md Location:** Three different conventions exist:
- Root of project: `macos-hub/CLAUDE.md`, `receipts/CLAUDE.md`, `shiphawk-templates/CLAUDE.md`, `tron-castle-fight/CLAUDE.md`
- In `.claude/` directory: `Parks/EasyStreet/.claude/CLAUDE.md`, `Parks/easystreet-monorepo/.claude/CLAUDE.md`

**CLAUDE.md Structure and Depth:** Wide variation:
- `receipts/CLAUDE.md` is 436 lines with plugins, skills, worktrees, code review, tracking sections, and cross-references to `.claude/docs/` subdocuments
- `tron-castle-fight/CLAUDE.md` is 75 lines with minimal structure
- `macos-hub/CLAUDE.md` is 69 lines, clean but compact
- `shiphawk-templates/CLAUDE.md` is 128 lines, focused on templating workflow
- EasyStreet native CLAUDE.md is 744 lines -- extremely detailed with agent usage standards, complete timeline spec, plugins inventory

**Change Tracking:** Three different approaches:
- `timeline.md` (receipts, EasyStreet, easystreet-monorepo, shiphawk-templates): date-ordered entries documenting sessions
- `PROJECT_LOG.md` (tron-castle-fight): numbered entry format with structured fields (Timestamp, Title, Request Summary, Why, Actions, Files Changed, Validation, Commit, Next Steps)
- `note-taker.md` (receipts only): confusion/resolution tracking and self-improvement patterns
- No tracking (macos-hub, automation-hub)

**Skills Infrastructure:**
- receipts: 5 custom skills in `.claude/skills/` with a SKILLS_REGISTRY.md, plus extensive plugin catalog
- tron-castle-fight: 1 custom skill (`project-log-updater`) referenced via AGENTS.md
- EasyStreet: no custom skills, relies on plugins (superpowers, code-review, etc.)
- macos-hub, shiphawk-templates: no skills

**Grouping Convention:**
- `/Apps/Parks/` groups both EasyStreet variants (native and monorepo)
- `/Apps/SH/` groups ShipHawk-related projects (shiphawk-dev and automation-hub)
- Other projects sit at the root level

### 1.3 Strengths to Preserve

1. **The root CLAUDE.md is well-structured.** It provides a clear catalog of all projects with stack, key commands, and architecture. This should remain the authoritative index.

2. **Receipts project is the gold standard.** Its CLAUDE.md, skills, `.claude/docs/` documentation, `note-taker.md`, and timeline tracking represent the most mature pattern. New projects should aspire to its structure.

3. **Timeline tracking already exists in 4/6 non-SH projects.** The convention is established even if formats vary.

4. **The `codex-self-sufficient-skillops-guide.md` at the root** provides a well-documented framework for autonomous agent workflows that can inform workspace-level standards.

5. **Project independence is respected.** Each project has its own git repo, build system, and conventions. The root CLAUDE.md does not override project-specific rules.

---

## 2. Workspace Standards Framework

### 2.1 Root CLAUDE.md Enhancements

The root `/Apps/CLAUDE.md` should be enhanced with three new sections: **Workspace Standards**, **Documentation Index**, and **New Project Checklist**. These additions should be appended after the existing "Cross-Project Patterns" section, preserving everything already there.

#### 2.1.1 Workspace Standards Section

This section defines the minimum requirements every project in `/Apps/` must meet. It is not prescriptive about implementation details -- each project retains its own conventions -- but it sets a baseline.

```markdown
## Workspace Standards

Every project in /Apps/ must meet these baseline requirements. Project-specific CLAUDE.md files may add stricter rules but may not weaken these.

### Required Documentation
1. **CLAUDE.md** — Project instructions for Claude Code. Location: either project root or `.claude/CLAUDE.md` (both are valid).
2. **Change tracking file** — Either `timeline.md` or `PROJECT_LOG.md`. Must be updated after every development session.
3. **README.md** — User-facing project overview with setup instructions.

### CLAUDE.md Minimum Sections
Every project CLAUDE.md must include at minimum:
- **Overview** — What the project does (1-3 sentences)
- **Stack** — Languages, frameworks, and key dependencies
- **Key Commands** — Build, test, lint, dev server commands
- **Architecture** — Directory structure and design patterns
- **Git Workflow** — Branch naming, commit format

### Directory Structure Standards
- Group related projects in subdirectories (e.g., `Parks/` for EasyStreet variants, `SH/` for ShipHawk ecosystem)
- New groups follow the pattern: `/Apps/<GroupName>/<ProjectName>/`
- Standalone projects sit at `/Apps/<ProjectName>/`
- Workspace-level documentation lives in `/Apps/docs/`

### Naming Conventions
- **Project directories:** lowercase-with-hyphens (`my-project`, not `MyProject` or `my_project`)
- **Group directories:** PascalCase for product families (`Parks/`, `SH/`), lowercase-with-hyphens for functional groups
- **Documentation files:** PascalCase for proper-noun files (`CLAUDE.md`, `README.md`), lowercase-with-hyphens for content files (`timeline.md`, `note-taker.md`)
- **Plans and reports:** date-prefixed (`2026-02-08-plan-name.md`)

### Change Tracking Conventions
- Use `timeline.md` for session-based tracking (default) or `PROJECT_LOG.md` for entry-based tracking
- Every entry must include: date, what was done, files changed, and next steps
- Reference commit hashes when code was committed
```

#### 2.1.2 Documentation Index Section

```markdown
## Documentation Index

### Workspace-Level
- `/Apps/docs/` — Central documentation hub
- `/Apps/docs/guides/` — Plugin and tool user guides
- `/Apps/docs/reports/` — Research reports and analysis outputs
- `/Apps/docs/templates/` — Reusable templates for documentation
- `/Apps/docs/plans/` — Workspace-level implementation plans
- `/Apps/timeline.md` — Workspace-level action log

### Reference Documents
- `codex-self-sufficient-skillops-guide.md` — Autonomous AI agent system setup
- `Notion-Practical-Guide.md` — Notion usage reference
- `Mac-Keyboard-Shortcuts.md` — macOS keyboard shortcuts
- `Mac-Window-Tiling-Shortcuts.md` — macOS window tiling
- `Tmux-Cheatsheet.md` — Tmux commands and workflows
```

#### 2.1.3 Cross-Project Dependencies Note

Add to the existing "Cross-Project Patterns" section:

```markdown
- **Shared business logic:** EasyStreet (native) and easystreet-monorepo share the sweepingRuleEngine and holidayCalculator concepts. Changes to holiday logic or sweeping rules in one should be verified against the other.
- **ShipHawk ecosystem:** shiphawk-templates produces templates consumed by shiphawk-dev. Template variable references must align with shiphawk-dev's data schema.
- **macOS Hub MCP server:** macos-hub provides MCP tools used by Claude Code across all projects. Changes to its tool interface affect all projects that use those tools.
```

### 2.2 CLAUDE.md Quality Tiers

Rather than enforcing identical CLAUDE.md structures, define three quality tiers that projects should aspire to:

**Tier 1 (Minimum) -- All projects must meet:**
- Overview, Stack, Key Commands, Architecture, Git Workflow sections
- Working build and test commands

**Tier 2 (Standard) -- Active projects should meet:**
- Tier 1 plus: Testing conventions, Code style rules, Environment setup, Important notes/gotchas
- Change tracking file (`timeline.md` or `PROJECT_LOG.md`)

**Tier 3 (Mature) -- Complex or long-lived projects should meet:**
- Tier 2 plus: `.claude/docs/` with architecture docs, pattern docs, common-mistakes doc
- Custom skills with a SKILLS_REGISTRY.md
- Plugin inventory and configuration documentation
- Development tracking rules (timeline entry format, self-improvement loop)

**Current tier assessment:**
| Project | Current Tier | Target Tier |
|---------|-------------|-------------|
| receipts | 3 | 3 (already there) |
| EasyStreet (native) | 3 | 3 (already there) |
| easystreet-monorepo | 2 | 2 |
| macos-hub | 1 | 2 |
| shiphawk-templates | 2 | 2 |
| tron-castle-fight | 2 | 2 |
| automation-hub | 0 | 1 |

---

## 3. Plugin/Tool User Guides Framework

### 3.1 Directory Structure

```
/Apps/docs/
  guides/
    plugins/
      superpowers.md            # Superpowers plugin usage guide
      code-review.md            # Code review plugin guide
      commit-commands.md        # Commit workflow guide
      ralph-loop.md             # Ralph loop guide
      claude-md-management.md   # CLAUDE.md management guide
      feature-dev.md            # Feature development workflow guide
      dev-browser.md            # Browser automation guide
      context7.md               # Library documentation lookup guide
    mcp-servers/
      macos-hub.md              # macOS Hub MCP server guide
      github.md                 # GitHub MCP server guide
      slack.md                  # Slack MCP server guide
      notion.md                 # Notion MCP server guide
      figma.md                  # Figma MCP server guide
    tools/
      tmux-for-claude-code.md   # Using tmux with Claude Code
      git-worktrees.md          # Git worktrees workflow
      xcodegen.md               # XcodeGen project generation
    skills/
      writing-skills.md         # How to write Claude Code skills
      skill-patterns.md         # Common skill patterns and templates
```

### 3.2 Guide Template

Every guide should follow this structure:

```markdown
# [Tool/Plugin Name] — User Guide

**Category:** Plugin | MCP Server | Tool | Skill
**Scope:** User-scoped | Project-scoped | Both
**Projects using this:** [list of projects]
**Last updated:** YYYY-MM-DD

## What It Does

[1-3 sentences explaining the tool's purpose and value proposition.]

## Setup

### Prerequisites
- [requirement 1]
- [requirement 2]

### Installation
[Step-by-step installation commands]

### Configuration
[Configuration files and settings]

## Usage

### Quick Start
[Fastest path to using the tool productively — 3-5 steps]

### Common Operations
| Operation | Command/Action | Example |
|-----------|---------------|---------|
| [op1] | [how] | [example] |

### Advanced Usage
[More complex workflows and patterns]

## Integration with Other Tools

[How this tool works with other tools in the workspace]

## Troubleshooting

| Problem | Solution |
|---------|----------|
| [issue1] | [fix1] |

## References

- [Official documentation](url)
- [Related workspace files](relative-path)
```

### 3.3 Priority Guide List

Based on the workspace analysis, these guides should be created first (ordered by impact):

1. **`plugins/superpowers.md`** -- Used by both EasyStreet and receipts. The 15-skill system is powerful but complex. A consolidated guide would benefit any project adopting it.

2. **`mcp-servers/macos-hub.md`** -- The workspace's own MCP server. A user guide explaining all 29 tools with practical examples would be valuable. The existing `README.md` in macos-hub is a good start but lacks usage scenarios.

3. **`skills/writing-skills.md`** -- The receipts project's `/create-skill` skill contains the knowledge, but a standalone guide extracted from it would serve the entire workspace.

4. **`plugins/commit-commands.md`** -- Used across multiple projects. The `/commit`, `/commit-push-pr`, and `/clean_gone` commands need a quick-reference guide.

5. **`tools/git-worktrees.md`** -- Documented extensively in the receipts CLAUDE.md. Should be extracted into a standalone guide that any project can reference.

6. **`plugins/code-review.md`** -- The multi-agent review system is documented in the receipts CLAUDE.md but deserves its own guide with examples.

---

## 4. App Research Skill Design

### 4.1 Purpose

Design a reusable Claude Code skill named `/research-app` that can be invoked on any project in the `/Apps/` workspace to produce a structured research report. This skill would be installed at the workspace level (either in `/Apps/.claude/skills/` or as a personal skill at `~/.claude/skills/`).

### 4.2 Skill Specification

**File:** `/Apps/.claude/skills/research-app/SKILL.md`

```yaml
---
name: research-app
description: Analyze an app codebase and generate a structured research report with architecture, dependencies, patterns, and recommendations
argument-hint: [project-path-or-name]
allowed-tools: Read, Glob, Grep, Bash(ls:*), Bash(wc:*), Bash(git:*), Bash(find:*), Bash(du:*)
context: fork
agent: Explore
---
```

### 4.3 Inputs

The skill takes one required input:

| Input | Source | Description |
|-------|--------|-------------|
| `$0` | Argument | Project path (relative to `/Apps/` or absolute) or project name matching a key in root CLAUDE.md |

If `$0` is a short name like `receipts` or `macos-hub`, the skill should resolve it to the full path by reading the root CLAUDE.md project catalog. If the path contains a group prefix (like `Parks/EasyStreet`), it should handle that as well.

### 4.4 Research Process

The skill should execute these steps in order:

**Step 1: Identify the Project**
- Resolve `$0` to an absolute path
- Verify the directory exists
- Check if it's a git repository (`git -C <path> rev-parse --is-inside-work-tree`)

**Step 2: Read Existing Documentation**
- Check for CLAUDE.md (root or `.claude/CLAUDE.md`)
- Check for README.md
- Check for timeline.md or PROJECT_LOG.md
- Check for AGENTS.md
- Check for `.claude/docs/` subdirectory
- Check for `.claude/skills/SKILLS_REGISTRY.md`
- Read and extract key information from each

**Step 3: Analyze Codebase Structure**
- Run `ls -la` on the project root
- Count files by type (using `find` and `wc`)
- Identify source directories vs config vs docs
- Measure total codebase size (`du -sh`)
- Identify the primary language(s) by file extension distribution

**Step 4: Analyze Dependencies**
- Look for dependency files: `package.json`, `Gemfile`, `requirements.txt`, `pyproject.toml`, `Podfile`, `build.gradle.kts`, `Cargo.toml`
- Extract key dependencies and their versions
- Identify dependency management tool (npm, poetry, bundler, etc.)

**Step 5: Analyze Architecture**
- Map the directory tree (2-3 levels deep)
- Identify architectural patterns (MVC, MVVM, service objects, etc.)
- Count models/views/controllers/services/tests
- Identify API frameworks, database usage, queue systems

**Step 6: Analyze Git History**
- Total commit count (`git log --oneline | wc -l`)
- Date range of commits
- Recent activity (last 10 commits)
- Contributors (`git shortlog -sn`)
- Branch listing

**Step 7: Assess CLAUDE.md Quality**
- Check against the Tier 1/2/3 requirements defined in Section 2.2
- Identify missing sections
- Score the CLAUDE.md completeness

**Step 8: Identify Gaps and Recommendations**
- Missing documentation
- Missing tests or test infrastructure
- Missing CI/CD configuration
- Opportunities for skills or plugins
- Cross-project dependencies to document

### 4.5 Output Format

The skill produces a report file at `/Apps/docs/reports/<project-name>-research-<date>.md` with this structure:

```markdown
# App Research Report: [Project Name]

**Generated:** YYYY-MM-DD
**Project Path:** /Users/trey/Desktop/Apps/<path>
**Analyzed by:** research-app skill

---

## Executive Summary
[2-3 sentence overview of what the project is, its maturity, and key findings]

## Project Identity
| Field | Value |
|-------|-------|
| Name | [name] |
| Description | [description] |
| Primary Language(s) | [languages] |
| Framework(s) | [frameworks] |
| Status | [Active/Maintenance/Archived] |
| Git Repository | [Yes/No] |
| Total Commits | [N] |
| First Commit | [date] |
| Last Activity | [date] |

## Technology Stack
### Runtime & Languages
- [list]

### Frameworks & Libraries
- [list with versions]

### Infrastructure
- [databases, queues, caches, etc.]

### Build & Test Tools
- [list]

## Architecture
### Directory Structure
[2-3 level tree diagram]

### Design Patterns
[identified patterns]

### Key Components
| Component | Location | Purpose | Size |
|-----------|----------|---------|------|
| [name] | [path] | [what it does] | [lines/files] |

## Codebase Metrics
| Metric | Value |
|--------|-------|
| Total Size | [disk size] |
| Source Files | [count] |
| Test Files | [count] |
| Configuration Files | [count] |
| Documentation Files | [count] |
| Lines of Code (estimated) | [count] |

## Documentation Assessment
### Existing Documentation
| Document | Location | Quality |
|----------|----------|---------|
| CLAUDE.md | [path] | [Tier 1/2/3] |
| README.md | [path] | [Good/Fair/Missing] |
| timeline.md | [path] | [Present/Missing] |

### CLAUDE.md Completeness
| Section | Present | Quality |
|---------|---------|---------|
| Overview | [Y/N] | [notes] |
| Stack | [Y/N] | [notes] |
| Key Commands | [Y/N] | [notes] |
| Architecture | [Y/N] | [notes] |
| Git Workflow | [Y/N] | [notes] |
| Testing | [Y/N] | [notes] |
| Code Style | [Y/N] | [notes] |
| Plugins/Skills | [Y/N] | [notes] |

## Dependencies
### Production Dependencies
[table of key deps with versions]

### Dev Dependencies
[table of key dev deps]

### Potential Concerns
- [outdated deps, security advisories, version conflicts]

## Cross-Project Relationships
- [how this project relates to others in /Apps/]
- [shared data, shared logic, dependency on other /Apps/ projects]

## Recommendations
### Immediate (Priority)
1. [recommendation with rationale]

### Short-Term
1. [recommendation with rationale]

### Long-Term
1. [recommendation with rationale]

## Raw Data
### Recent Git Log
[last 10 commits]

### File Type Distribution
[extension counts]
```

### 4.6 Supporting Files

The skill should include:

- `SKILL.md` -- Main instructions (as specified above)
- `report-template.md` -- The output template (as shown in 4.5)
- `checklist.md` -- A compact checklist version of the research steps for quick reference

### 4.7 Invocation Examples

```
/research-app receipts
/research-app Parks/EasyStreet
/research-app macos-hub
/research-app /Users/trey/Desktop/Apps/tron-castle-fight
```

---

## 5. Documentation Architecture

### 5.1 /Apps/docs/ Directory Structure

```
/Apps/docs/
  README.md                         # Index of all documentation
  guides/                           # How-to guides for tools and workflows
    plugins/                        # Claude Code plugin guides
    mcp-servers/                    # MCP server guides
    tools/                          # Development tool guides
    skills/                         # Skill authoring guides
  reports/                          # Research outputs and analysis
    <project-name>-research-<date>.md
  plans/                            # Implementation and project plans
    <date>-<plan-name>.md
  templates/                        # Reusable templates
    claude-md-minimum.md            # Tier 1 CLAUDE.md template
    claude-md-standard.md           # Tier 2 CLAUDE.md template
    timeline-entry.md               # Standard timeline entry format
    project-log-entry.md            # PROJECT_LOG.md entry format
    research-report.md              # App research report template
    guide-template.md               # Plugin/tool guide template
```

### 5.2 /Apps/docs/README.md Content

This file serves as the index/navigation page for all workspace documentation:

```markdown
# /Apps Documentation Hub

Central documentation for the multi-project workspace.

## Guides
User guides for plugins, MCP servers, tools, and skills used across projects.
- [Plugin Guides](guides/plugins/) — Claude Code plugins
- [MCP Server Guides](guides/mcp-servers/) — MCP server usage
- [Tool Guides](guides/tools/) — Development tools
- [Skill Guides](guides/skills/) — Writing and using Claude Code skills

## Reports
Research reports and analysis outputs generated by the `/research-app` skill.
- Reports are named `<project>-research-<date>.md`

## Plans
Implementation plans and project-level strategies.
- Plans are named `<date>-<plan-name>.md`

## Templates
Reusable templates for documentation and project setup.
- CLAUDE.md templates (minimum and standard)
- Timeline and project log entry formats
- Research report template
- Guide template
```

### 5.3 Report Format Standards

All reports in `/Apps/docs/reports/` must follow these conventions:

1. **File naming:** `<project-name>-<report-type>-<YYYY-MM-DD>.md`
   - Examples: `receipts-research-2026-02-08.md`, `macos-hub-audit-2026-02-10.md`

2. **Required header metadata:**
   ```markdown
   # [Report Type]: [Project Name]
   
   **Generated:** YYYY-MM-DD
   **Author:** [human name or agent identifier]
   **Project Path:** [absolute path]
   **Report Type:** Research | Audit | Comparison | Planning
   ```

3. **Required sections:**
   - Executive Summary (always first, 2-3 sentences)
   - Findings or Analysis (the body of the report)
   - Recommendations (always last, actionable items)

4. **Quality standards:**
   - Reference absolute file paths for all mentioned files
   - Include quantitative data where possible (line counts, file counts, dependency counts)
   - Distinguish between facts (observed) and recommendations (opinion)

### 5.4 Timeline.md Conventions

The workspace-level `/Apps/timeline.md` tracks actions performed at the workspace root. It should use a lighter format than project-level timelines, since workspace actions are typically organizational rather than code-level:

```markdown
## YYYY-MM-DD — Action Title

**Session:** [brief description of what this session was about]

### Actions
- **Created/Modified/Deleted** [file or directory] — [why]
- **Deployed** [agents or processes] — [what they're doing]
- **Decided** [decision] — [rationale]

### Notes
- [any relevant context for future reference]
```

Project-level timelines should continue using their established formats. The two dominant formats are:

**Format A (timeline.md with session entries) -- used by receipts, EasyStreet, shiphawk-templates:**
```markdown
### YYYY-MM-DD: Entry Title (commit_hash) [STATUS_EMOJI] STATUS

**What was completed:**
1. **Section** — details
2. **Section** — details

**Files Created/Modified/Deleted:**
- `path/to/file` — description

**Verification:**
- command — result

**Next Steps:**
- item
```

**Format B (PROJECT_LOG.md with numbered entries) -- used by tron-castle-fight:**
```markdown
### Entry NNNN
- Timestamp: ISO-8601
- Title: Short title
- Request Summary: What was requested
- Why: Why the change was needed
- Actions: [list]
- Files Changed: [list]
- Validation: [list]
- Commit: hash or pending
- Next Steps: [list]
```

Both formats are valid. New projects should default to Format A (`timeline.md`) unless they have a specific reason to prefer Format B.

---

## 6. Future App Onboarding Process

### 6.1 When a New App is Added to /Apps

When a new project is created in or moved to `/Apps/`, the following steps should be executed. This process can be partially automated via a `/onboard-new-app` workspace-level skill.

### 6.2 Step-by-Step Onboarding Checklist

**Phase 1: Directory Setup**

1. Determine placement:
   - If the project belongs to an existing group (Parks, SH), place it under that group: `/Apps/<Group>/<project-name>/`
   - If standalone, place at root: `/Apps/<project-name>/`
   - Directory name must be lowercase-with-hyphens

2. Verify git repository:
   - If the project has no git repo, initialize one: `git init`
   - Create `.gitignore` appropriate to the stack

**Phase 2: Documentation Generation**

3. Generate CLAUDE.md:
   - Use the `/research-app` skill to analyze the codebase
   - Use the output to populate a CLAUDE.md from the appropriate tier template (`/Apps/docs/templates/claude-md-minimum.md` or `claude-md-standard.md`)
   - Place it at either the project root or `.claude/CLAUDE.md` (prefer root for simplicity)
   - Must include at minimum: Overview, Stack, Key Commands, Architecture, Git Workflow

4. Generate README.md (if missing):
   - Create a user-facing README with project description, setup instructions, and usage

5. Initialize timeline.md:
   - Create `timeline.md` at the project root
   - Add an initial entry documenting the project's creation or addition to the workspace

**Phase 3: Root CLAUDE.md Integration**

6. Add project to root CLAUDE.md:
   - Add a new section under `## Projects` following the existing format:
     ```markdown
     ### <project-name> -- <Short Description>
     <1-2 sentence description>

     **Stack:** [list]

     **Key commands:**
     [code block with build/test/run commands]

     **Architecture:** [summary]
     ```
   - If the project has its own CLAUDE.md, note its location: "Has its own CLAUDE.md at `<path>`."

7. Update Cross-Project Patterns:
   - If the new project has relationships with existing projects, document them
   - If the project uses timeline.md, add it to the timeline tracking bullet
   - If the project has its own CLAUDE.md, add it to the project-level CLAUDE.md bullet

**Phase 4: Initial Research**

8. Run `/research-app` on the project:
   - Generate a full research report
   - Store at `/Apps/docs/reports/<project-name>-research-<date>.md`
   - Review recommendations and act on immediate items

**Phase 5: Workspace Timeline Update**

9. Update `/Apps/timeline.md`:
   - Add an entry documenting the new project's addition
   - Note the project's location, stack, and any initial setup actions taken

### 6.3 /onboard-new-app Skill Design

This would be a workspace-level skill that automates the checklist above.

**Location:** `/Apps/.claude/skills/onboard-new-app/SKILL.md`

```yaml
---
name: onboard-new-app
description: Onboard a new application into the /Apps workspace -- generates CLAUDE.md, timeline.md, updates root index, and runs initial research
argument-hint: [project-path]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(git:*), Bash(find:*), Bash(wc:*), Bash(du:*), Bash(mkdir:*), Skill
---
```

The skill should:
1. Accept a project path as `$0`
2. Verify the project exists and determine its group placement
3. Check what documentation already exists
4. Generate missing documentation using templates
5. Invoke `/research-app` for the full analysis
6. Update the root CLAUDE.md
7. Update `/Apps/timeline.md`
8. Present a summary of everything created

### 6.4 Template Files Needed

Two CLAUDE.md templates should be created:

**`/Apps/docs/templates/claude-md-minimum.md`** (Tier 1):
```markdown
# [Project Name]

## Overview
[What the project does — 1-3 sentences]

## Stack
[Languages, frameworks, key dependencies]

## Key Commands
[Build, test, lint, run commands in a code block]

## Architecture
[Directory structure diagram and design pattern summary]

## Git Workflow
[Branch naming, commit format, merge strategy]
```

**`/Apps/docs/templates/claude-md-standard.md`** (Tier 2):
All of Tier 1 plus:
```markdown
## Testing
[Test framework, how to run tests, conventions]

## Code Style
[Formatting tools, indentation, naming conventions]

## Environment Setup
[Prerequisites, installation steps, required API keys]

## Important Notes
[Gotchas, known issues, large files, performance considerations]

## Development Timeline
**File:** timeline.md
Update after every development session.
```

---

## 7. Implementation Phases

### Phase 1: Immediate (Days 1-2) -- Standards, Templates, Directory Structure

**Priority:** Establish the foundation that all subsequent work builds on.

**Deliverables:**

| # | Task | Location | Effort |
|---|------|----------|--------|
| 1.1 | Create `/Apps/docs/` subdirectory structure | `/Apps/docs/{guides,reports,plans,templates}/` and nested dirs | 5 min |
| 1.2 | Create `/Apps/docs/README.md` index | `/Apps/docs/README.md` | 15 min |
| 1.3 | Create CLAUDE.md Tier 1 template | `/Apps/docs/templates/claude-md-minimum.md` | 15 min |
| 1.4 | Create CLAUDE.md Tier 2 template | `/Apps/docs/templates/claude-md-standard.md` | 20 min |
| 1.5 | Create timeline entry template | `/Apps/docs/templates/timeline-entry.md` | 10 min |
| 1.6 | Create guide template | `/Apps/docs/templates/guide-template.md` | 10 min |
| 1.7 | Create research report template | `/Apps/docs/templates/research-report.md` | 15 min |
| 1.8 | Update root CLAUDE.md with Workspace Standards section | `/Apps/CLAUDE.md` | 20 min |
| 1.9 | Update root CLAUDE.md with Documentation Index section | `/Apps/CLAUDE.md` | 10 min |
| 1.10 | Update root CLAUDE.md with macos-hub project entry (currently missing from Projects section) | `/Apps/CLAUDE.md` | 10 min |
| 1.11 | Update root CLAUDE.md with automation-hub reference (if desired) | `/Apps/CLAUDE.md` | 5 min |
| 1.12 | Initialize `timeline.md` for macos-hub | `/Apps/macos-hub/timeline.md` | 10 min |

**Total Phase 1 effort:** ~2.5 hours

**Dependencies:** None. This phase has no prerequisites.

**Validation:** After Phase 1, verify that:
- All directories in `/Apps/docs/` exist
- All template files are well-formed markdown
- Root CLAUDE.md has the new sections
- `macos-hub` has a `timeline.md`

### Phase 2: Short-Term (Days 3-7) -- Skill Creation, Initial Guides

**Priority:** Create the tools that make ongoing workspace management sustainable.

**Deliverables:**

| # | Task | Location | Effort | Dependencies |
|---|------|----------|--------|--------------|
| 2.1 | Create `/research-app` skill | `/Apps/.claude/skills/research-app/{SKILL.md, report-template.md, checklist.md}` | 45 min | 1.7 |
| 2.2 | Create `/onboard-new-app` skill | `/Apps/.claude/skills/onboard-new-app/SKILL.md` | 30 min | 1.3, 1.4, 2.1 |
| 2.3 | Create workspace-level SKILLS_REGISTRY.md | `/Apps/.claude/skills/SKILLS_REGISTRY.md` | 10 min | 2.1, 2.2 |
| 2.4 | Run `/research-app` on macos-hub | `/Apps/docs/reports/macos-hub-research-<date>.md` | 20 min | 2.1 |
| 2.5 | Run `/research-app` on tron-castle-fight | `/Apps/docs/reports/tron-castle-fight-research-<date>.md` | 20 min | 2.1 |
| 2.6 | Run `/research-app` on shiphawk-templates | `/Apps/docs/reports/shiphawk-templates-research-<date>.md` | 20 min | 2.1 |
| 2.7 | Write superpowers plugin guide | `/Apps/docs/guides/plugins/superpowers.md` | 45 min | 1.6 |
| 2.8 | Write macOS Hub MCP server guide | `/Apps/docs/guides/mcp-servers/macos-hub.md` | 30 min | 1.6 |
| 2.9 | Write skill authoring guide | `/Apps/docs/guides/skills/writing-skills.md` | 30 min | 1.6 |
| 2.10 | Write commit-commands plugin guide | `/Apps/docs/guides/plugins/commit-commands.md` | 20 min | 1.6 |

**Total Phase 2 effort:** ~4.5 hours

**Dependencies:** Phase 1 must be complete (templates and directory structure).

**Validation:** After Phase 2, verify that:
- Both skills (`/research-app` and `/onboard-new-app`) are invocable
- Research reports are generated correctly for at least one project
- Guide files follow the template structure
- SKILLS_REGISTRY.md is accurate

### Phase 3: Ongoing (Week 2+) -- Maintenance, Expansion, Refinement

**Priority:** Keep the system alive and extend coverage as the workspace evolves.

**Recurring Tasks:**

| # | Task | Frequency | Responsible |
|---|------|-----------|-------------|
| 3.1 | Run `/research-app` on any project that has changed significantly | After major milestones | App Manager |
| 3.2 | Update root CLAUDE.md when projects are added/removed/significantly changed | As needed | App Manager |
| 3.3 | Update `/Apps/timeline.md` for workspace-level actions | Every workspace session | App Manager / Agent |
| 3.4 | Write additional plugin/tool guides as new tools are adopted | When tools are added | App Manager |
| 3.5 | Review and update templates based on usage feedback | Monthly | App Manager |
| 3.6 | Upgrade macos-hub CLAUDE.md to Tier 2 | Week 2 | Agent |
| 3.7 | Upgrade automation-hub to Tier 1 (create CLAUDE.md) | Week 2 | Agent |
| 3.8 | Create `/add-to-timeline` skill at workspace level (adapted from receipts version) | Week 2 | Agent |
| 3.9 | Write remaining plugin guides (code-review, ralph-loop, feature-dev, dev-browser) | Weeks 2-4 | Agent |
| 3.10 | Write tool guides (git-worktrees, tmux-for-claude-code) | Weeks 2-4 | Agent |
| 3.11 | Create `/audit-workspace` skill that checks all projects against Tier requirements | Week 3 | Agent |
| 3.12 | Evaluate SkillOps adoption from `codex-self-sufficient-skillops-guide.md` | Week 4 | App Manager |

**New App Onboarding (as needed):**
- Invoke `/onboard-new-app <path>` which automates the 9-step checklist from Section 6.2
- Review generated CLAUDE.md and timeline.md for accuracy
- Verify root CLAUDE.md was updated correctly

### Phase 3 Long-Term Considerations

1. **Cross-project skill sharing:** The receipts project has 5 mature skills. Consider extracting the most generally useful ones (`/add-to-timeline`, `/create-skill`, `/audit-code`) to workspace level so all projects can use them. This requires parameterizing project-specific references.

2. **Workspace-level `.claude/settings.json`:** The workspace root already has `/Apps/.claude/settings.local.json` with permissions. Consider adding a full `settings.json` with plugin recommendations that apply to all projects opened from `/Apps/`.

3. **Automated workspace health checks:** A `/audit-workspace` skill could:
   - Check every project has a CLAUDE.md meeting its tier requirements
   - Verify timeline files are being maintained (last entry within N days)
   - Flag projects without recent git activity
   - Detect orphaned worktrees or stale branches

4. **Documentation freshness:** Reports in `/Apps/docs/reports/` should be re-generated periodically. Consider adding a `last-validated` date to each report and flagging any older than 30 days.

---

## Key Design Decisions and Rationale

### Decision 1: Tiers Instead of Uniform Requirements
**Rationale:** The projects vary dramatically in complexity (tron-castle-fight is 3 files; receipts is a full-stack platform with 50+ files). Requiring every project to have `.claude/docs/` with architecture documents, skills, and plugin catalogs would be wasteful for simple projects. Tiers allow each project to document at the right level of detail.

### Decision 2: Workspace-Level Skills in /Apps/.claude/skills/
**Rationale:** Claude Code looks for skills in `.claude/skills/` relative to the working directory. By placing workspace-level skills at `/Apps/.claude/skills/`, they are available when working from the workspace root but do not pollute individual project directories. This keeps workspace concerns separate from project concerns.

### Decision 3: Preserving Existing Format Diversity
**Rationale:** The receipts project uses `timeline.md` with session entries; tron-castle-fight uses `PROJECT_LOG.md` with numbered entries. Both work well for their contexts. Forcing a single format would require rewriting existing documentation and disrupting established patterns. Instead, the plan documents both formats and lets new projects choose.

### Decision 4: /Apps/docs/ as a Flat Central Hub
**Rationale:** Guides, reports, and templates benefit from being discoverable in one place rather than scattered across project directories. A user asking "how do I use the superpowers plugin?" should not have to know that the answer is in the receipts project's CLAUDE.md. Centralizing this knowledge makes it accessible to all projects.

### Decision 5: Research Skill Uses fork Context
**Rationale:** The `/research-app` skill runs as a subagent in explore mode (`context: fork`, `agent: Explore`). This isolates the research work from the main conversation, prevents the large output from consuming the parent context window, and allows the skill to be invoked as part of a larger workflow (like `/onboard-new-app`) without overwhelming the orchestrator.

---

### Critical Files for Implementation

- `/Users/trey/Desktop/Apps/CLAUDE.md` - Root workspace index that needs Workspace Standards, Documentation Index, and New Project Checklist sections added
- `/Users/trey/Desktop/Apps/receipts/CLAUDE.md` - Gold-standard reference for CLAUDE.md structure (Tier 3), skills documentation, plugin catalogs, and development tracking patterns
- `/Users/trey/Desktop/Apps/receipts/.claude/skills/create-skill/SKILL.md` - Template and best practices for skill authoring; the `/research-app` and `/onboard-new-app` skills should follow this pattern
- `/Users/trey/Desktop/Apps/receipts/.claude/skills/add-to-timeline/SKILL.md` - Reference implementation for a timeline management skill; should be adapted for workspace-level use
- `/Users/trey/Desktop/Apps/codex-self-sufficient-skillops-guide.md` - Framework for autonomous agent workflows, observation logging, and skill lifecycle management; informs Phase 3 long-term SkillOps adoption