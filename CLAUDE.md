# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope Guardrail (Critical)

- Ignore `/Users/trey/Desktop/Apps/SH/shiphawk-dev` for all requests scoped to `/Users/trey/Desktop/Apps`.
- Do not read, search, edit, or run commands in `shiphawk-dev` unless the user explicitly directs work to `/Users/trey/Desktop/Apps/SH/shiphawk-dev`.
- If a request references "all apps" or "/Apps", treat `shiphawk-dev` as out of scope by default.

## Instruction Sync (Critical)

- When adding, removing, or changing a persistent workspace rule, update both:
  - `/Users/trey/Desktop/Apps/CLAUDE.md`
  - `/Users/trey/Desktop/Apps/AGENTS.md`
- Treat these files as a synchronized pair. A rule change is not complete until both files reflect it.
- For project-specific rule changes, apply the same sync rule in that project's instruction pair (`AGENTS.md` and `CLAUDE.md` or `.claude/CLAUDE.md`).

## Workspace Overview

This is a multi-project workspace. Each subdirectory is an independent project with its own stack, build system, and (where applicable) its own CLAUDE.md. Always check the project-specific CLAUDE.md first when working within a subdirectory.

## Projects

Each project below has its own CLAUDE.md with full details (stack, commands, architecture). This index provides a one-line summary for navigation only.

| Project | Description |
|---------|-------------|
| `MyLife/` | Unified hub app: 40 privacy-first registry modules + standalone apps (BestChef, DoWork, Manhattan, Meerkat) on iOS, Android, Web |
| `automation-hub/` | Multi-channel task automation engine (email, calendar, Slack, iMessage) |
| `SH/shiphawk-dev/` | Rails shipping platform (out of scope by default) |
| `Parks/EasyStreet/` | Street sweeping parking app (native iOS + Android) |
| `Parks/easystreet-monorepo/` | EasyStreet cross-platform (Expo + Next.js) |
| `receipts/` | Receipt verification platform (Django + React) |
| `SH/shiphawk-templates/` | Liquid-templated shipping document templates |
| `tron-castle-fight/` | Browser RTS game (vanilla JS + Canvas 2D) |
| `system-monitor/` | macOS system monitor daemon (Node.js + launchd) |
| `fed-memes/` | GIF/meme platform (Django + Swift + discord.js) |
| `MySurf/` | Surf forecasting app (Expo + Next.js + Supabase) |
| `MyBudget/` | Envelope budgeting app (Expo + Next.js + SQLite) |
| `MyBooks/` | Book tracking app (Expo + Next.js + SQLite) |
| `macos-hub/` | Retired MCP server (reference only) |
| `arenalite/` | Browser-based arena PvP prototype for Arena (TS + Three.js, deterministic sim over Arena's ability JSON) |

## Context7 -- Live Documentation

When writing code that uses external libraries, use Context7 MCP tools to fetch current docs. Call `resolve-library-id` then `query-docs`. Skip for pure business logic, markdown, or vanilla JS/TS.

## Cross-Project Patterns

- **Project-level CLAUDE.md:** Each project has its own. Always defer to those when working within a project.
- **Git conventions vary by project:** ShipHawk uses Jira-linked branches, Receeps/MySurf/MyBudget/MyBooks use Conventional Commits, EasyStreet uses `feature/`/`bugfix/` prefixes.
- **Shared business logic:** EasyStreet (native) and easystreet-monorepo share sweepingRuleEngine and holidayCalculator. Verify changes against both.
- **ShipHawk ecosystem:** shiphawk-templates produces templates consumed by shiphawk-dev. Variable references must align.

## Workspace Standards

Every project must have: CLAUDE.md, change tracking file (`timeline.md` or `PROJECT_LOG.md`), README.md.

### Directory Creation Guardrail (Critical)
- Never create ad-hoc directories at the `/Apps/` root for staging or scaffolding.
- The only valid pattern for sibling working directories is git worktrees: `../Apps-wt-[plan-name]`.
- Edit standalone submodule directories in place. Do not create copies or parallel trees.

### Naming Conventions
- **Project directories:** lowercase-with-hyphens
- **Group directories:** PascalCase (`Parks/`, `SH/`)
- **Reports:** `REPORT-<project>-YYYY-MM-DD.md`

## Documentation Index

- `/Apps/docs/` -- Central documentation hub
- `/Apps/docs/guides/` -- Plugin, MCP, tool, and skill guides
- `/Apps/docs/reports/` -- Research reports
- `/Apps/docs/plans/` -- Implementation plans and queue
- `/Apps/timeline.md` -- Workspace-level action log

### Workspace Skills
- `/research-app`, `/onboard-new-app`, `/research-documentation`, `/daily-report-ops`
- `/generate-architecture-diagrams`, `/scan-emails`, `/dispatch`

### Marketing Skills
25 skills at `.claude/skills/marketing/`. Registry: `.claude/skills/SKILLS_REGISTRY.md`.

## Plan Queue Protocol

Plans live in `docs/plans/{queue,active,done,failed}/`. See `docs/guides/parallel-agent-orchestration.md` for the full protocol. Key rules:
- Plans are markdown files with metadata, scope, phases, acceptance criteria
- Start from `docs/plans/templates/plan-template.md`
- Name: `[01-05]-[project]-[description].md`
- Move between queue -> active -> done/failed (never delete)
- Use `cmux` for worktree lifecycle, `/dispatch` for strategy selection
- Agent Teams for overlapping same-project work, parallel subagents for independent work

### Custom Agent Definitions
Defined in `.claude/agents/`: `plan-executor` (edits), `test-writer` (tests only), `docs-agent` (docs only), `reviewer` (read-only).

## Interaction Style Requirements

### Explanatory Output Mode
Provide brief educational insights using the star format after significant work:
```
`★ Insight ─────────────────────────────────────`
[2-3 key educational points specific to the codebase]
`─────────────────────────────────────────────────`
```

### Proactive User Check-Ins (AskUserQuestion)
Clarify ambiguous requirements before starting. Offer implementation choices. Confirm direction on multi-step tasks. Surface trade-offs.

## Writing Style
- Do not use em dashes in documents or writing.

### Code Intelligence

Prefer LSP over Grep/Read for code navigation:
- `workspaceSymbol`, `findReferences`, `goToDefinition`, `hover`
- Use Grep only for text/pattern searches
- Check LSP diagnostics after edits
