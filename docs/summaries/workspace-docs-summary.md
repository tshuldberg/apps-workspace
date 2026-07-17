# Workspace Documentation Summary (/Apps/docs/)

> Summary of all workspace-level docs in /Apps/docs/
> Generated: 2026-02-08

## Overview

The `/Apps/docs/` directory is the central documentation hub for the entire multi-project workspace. It contains **guides** (how to use tools, plugins, and skills), **reports** (research analysis and cross-project reviews), and **templates** (reusable scaffolds for standardizing documentation across projects). This hub serves as the connective tissue between individual project docs, providing workspace-wide standards and cross-cutting analysis that no single project doc covers on its own.

The docs hub was established on 2026-02-08 as part of a workspace standards initiative. All reports are from that date, reflecting a concentrated documentation sprint that surveyed every project in the workspace.

## Root Documents

### docs/README.md
The index page for the documentation hub. Lists all guides (organized by category: plugins, MCP servers, skills, reference), all reports (with a table of project/scope/size), all plans, and all templates. This is the starting point for navigating workspace-level documentation.

## Guides (docs/guides/)

### MCP Servers

**macos-hub.md** — Comprehensive user guide for the macOS Hub MCP server (29 tools across Reminders, Notes, Calendar, Mail, System, and Keybindings). Covers setup/installation, tool reference tables with parameters, common operations, custom keybinding configuration, watcher polling configuration, MCP resources, integration patterns, and troubleshooting. This is the authoritative reference for anyone using macOS Hub tools in any Claude Code session.

### Plugins

**commit-commands.md** — User guide for the commit-commands plugin providing `/commit`, `/commit-push-pr`, and `/clean_gone` commands. Documents how each command works (staging, message generation, PR creation), project-specific commit style adaptation (Conventional Commits vs Jira-linked), and worktree-aware branch cleanup. Used by receipts, EasyStreet (native), and easystreet-monorepo.

**superpowers.md** — User guide for the superpowers plugin, a 15-skill development workflow enforcer. Covers design/planning skills (brainstorming, writing-plans), implementation skills (TDD enforcement, systematic debugging, verification), execution skills (subagent-driven development, parallel agents, worktrees), and code review/completion skills. Documents trigger conditions, integration with other plugins, and troubleshooting. Used by receipts, EasyStreet (native), and easystreet-monorepo.

### Skills

**writing-skills.md** — Comprehensive skill authoring guide. Covers SKILL.md structure with YAML frontmatter, scope levels (project/workspace/personal), invocation models (user-only, Claude-only, both), argument substitution (`$0`/`$ARGUMENTS`), dynamic context injection (`` !`git branch` ``), allowed-tools configuration, supporting files, registration in SKILLS_REGISTRY.md, and testing procedures. Includes 4 workspace patterns (research, timeline, code generation, onboarding) and a common mistakes table.

### Reference Guides

**text-editing-shortcuts.md** — macOS + Claude Code text editing keyboard shortcuts. Covers cursor navigation (character/word/line/document), text selection, deletion (character/word/line), cut/copy/paste (both system clipboard and terminal kill ring), Claude Code-specific shortcuts (submit, multiline, history search, model switching), optional vim mode, and common workflows. Includes setup instructions for enabling Option-as-Meta in iTerm2/Terminal.app/VS Code.

*(Additional reference guides exist at the root level: Mac-Keyboard-Shortcuts.md, Mac-Window-Tiling-Shortcuts.md, Tmux-Cheatsheet.md, Notion-Practical-Guide.md — these are referenced from the docs README but live at `/Apps/` root level.)*

## Reports (docs/reports/)

### Cross-Project Reports

**2026-02-08-across-app-72-hour-summary.md** — Comprehensive activity summary across all 7 active repositories for the 72-hour window ending 2026-02-08. Key metrics: 108 commits, 8 merge commits, 6 GitHub PR merges. Breaks down work completed per project: EasyStreet (44 commits, Android foundation + iOS MVP), receipts (28 commits, 5 PRs merged, launch blockers), shiphawk-templates (21 commits, repo reorganization), macos-hub (8 commits, full MCP server build), easystreet-monorepo (2 commits, Turborepo scaffold). Identifies findings including timeline drift, stale branches, and blocked staging deployments.

**api-standards-review-2026-02-08.md** — Universal API standards review analyzing JSON/CSV data interchange across all projects. Compares ShipHawk (Grape API, most mature with 120+ endpoints), Receipts (DRF, cleanest REST conventions), EasyStreet Monorepo (Convex), and macOS Hub (MCP). Establishes universal standards for JSON response envelopes, key naming (snake_case canonical), error formats, pagination, datetime format, input validation, CSV import/export, auth headers, versioning, and content negotiation. Includes per-project compliance checklists.

**commit-pr-policy-review-2026-02-08.md** — Cross-project review of commit conventions, PR workflows, branch strategies, README structure, CI/CD pipelines, and code review standards. Compares all 7 projects. Key finding: ShipHawk has the most mature workflow (GitLab CI, 30 Danger rules), Receipts has the cleanest reproducible model (Conventional Commits, squash merge, GitHub Actions). Recommends Conventional Commits as workspace standard. Includes universal standards for 10 categories and per-project compliance checklists.

**claude-md-use-cases-2026-02-08.md** — Analysis of all 7 CLAUDE.md files across the workspace. Evaluates each file's sections, strengths, weaknesses, and unique patterns. Identifies receipts as the most comprehensive (436 lines) and tron-castle-fight as the most minimal (75 lines). Informs the CLAUDE.md quality tier system (Tier 1-3) adopted in the root CLAUDE.md.

**implementation-plan-2026-02-08.md** — Master implementation plan for workspace standards and infrastructure. Covers current state analysis (inventory of all projects with maturity assessments), workspace standards framework (CLAUDE.md requirements, change tracking), plugin/tool guides framework, app research skill design, documentation architecture (`/Apps/docs/` structure), and future app onboarding process. Defines implementation phases.

### Project Research Reports

Each project has a dedicated research report generated by the `/research-app` skill. These are deep-dive architectural analyses:

**macos-hub-research-2026-02-08.md** — Feature requirements document for the macOS Hub MCP server. Covers 29 tools, AppleScript bridge architecture, watcher system, keybinding framework, and TypeScript implementation details.

**easystreet-native-research-2026-02-08.md** — Feature requirements document for EasyStreet (iOS + Android native). Covers dual-platform architecture (Swift/UIKit + Kotlin/Jetpack Compose), SweepingRuleEngine, HolidayCalculator, SQLite database (37,856 segments), and app store launch readiness.

**easystreet-monorepo-research-2026-02-08.md** — Feature requirements document for the cross-platform monorepo. Covers Turborepo structure, Expo mobile app, Next.js web app, Convex backend, shared business logic packages, and multi-city expansion architecture.

**receipts-research-2026-02-08.md** — Feature requirements document for Receeps (receipt-based evidence verification). Covers Django REST API, React SPA, multi-dimensional voting system, staff verification workflow, notification system, and moderation infrastructure.

**shiphawk-templates-research-2026-02-08.md** — Feature requirements document for the template system. Covers Liquid templating, 28 packing slip templates, label JSON configs, shared CSS infrastructure, and the recent repository reorganization.

**tron-castle-fight-research-2026-02-08.md** — Feature requirements document for Neon Castle Clash browser RTS game. Covers Canvas 2D rendering, single-file engine architecture, entity/building/unit systems, AI opponent, and WebSocket multiplayer.

## Templates (docs/templates/)

**claude-md-minimum.md** — Tier 1 CLAUDE.md template with 5 required sections: Overview, Stack, Key Commands, Architecture, Git Workflow. The bare minimum for any project in the workspace.

**claude-md-standard.md** — Tier 2 CLAUDE.md template extending Tier 1 with Testing, Code Style, Environment Setup, Important Notes, and change tracking. The target for active projects.

**guide-template.md** — Template for plugin/MCP server/tool user guides. Includes frontmatter (category, scope, projects using, last updated), sections for setup, usage, advanced usage, integration, troubleshooting, and references.

**research-report.md** — Template for the `/research-app` skill output. Structures research reports with executive summary, tech stack, architecture, features, testing, and recommendations.

**timeline-entry.md** — Standard format for timeline.md entries. Includes date, session number, title, actions, files changed, technical decisions, and next steps.

## Comprehensive Detail

### 72-Hour Summary (Key Metrics)
The 72-hour summary is the most actionable cross-project document. Key takeaways:
- **EasyStreet** saw the most development velocity: 44 commits, test suite grew from 34 to 185 tests, Android foundation fully built
- **Receipts** is closest to production launch: 5 PRs merged, moderation system built, launch blockers W1-1 through W1-3 closed
- **Blockers identified**: receipts staging blocked by network access to pypi.org; easystreet-monorepo timeline is out of date
- **7 stale branches** identified across the workspace needing cleanup

### API Standards Review (Key Decisions)
The API review established workspace-wide conventions:
- **Wire format**: `snake_case` for all JSON keys
- **Response envelope**: `{ "data": ..., "meta": { "page", "total", "per_page" } }`
- **Error format**: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- **DateTime**: ISO 8601 always, UTC on wire
- **Pagination**: cursor-based preferred, offset OK for small datasets

### Implementation Plan (Phases)
The plan defines a phased rollout:
- Phase 1: Documentation standards (CLAUDE.md tiers, templates, docs hub)
- Phase 2: Skills and automation (research-app, onboard-new-app)
- Phase 3: Cross-project tooling (plugins, MCP servers)
- Phase 4: CI/CD and quality gates

## Cross-References to Project Docs

This section maps **from workspace docs TO project docs** — showing which project-level documentation each workspace doc connects to.

### Research Reports → Project Docs

| Workspace Report | Project Docs It Informs |
|-----------------|------------------------|
| `macos-hub-research` | `macos-hub/CLAUDE.md` — the research provided the architectural analysis that shaped the CLAUDE.md |
| `easystreet-native-research` | `Parks/EasyStreet/docs/plans/` — 11 plan docs that build on the research findings for launch readiness |
| `easystreet-monorepo-research` | `Parks/easystreet-monorepo/docs/easystreet-app-comparison.md` — compares native vs monorepo approaches |
| `receipts-research` | `receipts/docs/plans/` — 35+ docs covering filter overhaul, audit program, and launch execution that depend on the research baseline |
| `shiphawk-templates-research` | `shiphawk-templates/docs/` — template development guide and variable reference that the research analyzed |
| `tron-castle-fight-research` | `tron-castle-fight/PROJECT_LOG.md` — the structured change log that research documented |

### Cross-Project Reviews → Project Applicability

| Workspace Review | Applies To |
|-----------------|-----------|
| `api-standards-review` | receipts (DRF), easystreet-monorepo (Convex), macos-hub (MCP) — all have API layers that should follow the universal standards |
| `commit-pr-policy-review` | All projects — establishes Conventional Commits as workspace standard; receipts is the reference implementation |
| `claude-md-use-cases` | All projects — informed the CLAUDE.md quality tier system in root CLAUDE.md |
| `72-hour summary` | All projects — cross-references timeline.md files from EasyStreet, receipts, shiphawk-templates, and macos-hub |

### Guides → Project Usage

| Guide | Projects Using It |
|-------|------------------|
| `macos-hub.md` guide | All projects (user-scoped MCP server) |
| `commit-commands.md` guide | receipts, EasyStreet (native), easystreet-monorepo |
| `superpowers.md` guide | receipts, EasyStreet (native), easystreet-monorepo |
| `writing-skills.md` guide | receipts (5 custom skills), workspace (2 skills), tron-castle-fight (1 skill) |
| `text-editing-shortcuts.md` guide | All users (not project-specific) |

### Templates → Project Implementations

| Template | Projects Using/Implementing It |
|----------|-------------------------------|
| `claude-md-minimum.md` | macos-hub (currently Tier 1) |
| `claude-md-standard.md` | shiphawk-templates, tron-castle-fight, easystreet-monorepo (Tier 2 targets) |
| `timeline-entry.md` | receipts, EasyStreet, easystreet-monorepo, shiphawk-templates |
| `research-report.md` | Used by `/research-app` skill to generate all 6 project research reports |
