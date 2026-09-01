# AGENTS.md

Workspace-wide agent instructions for `/Users/trey/Desktop/Apps`. This file is the canonical instruction source at this level: `CLAUDE.md` imports it via `@AGENTS.md`. Edit rules here, never by hand-copying between the two files.

## Scope Guardrail (Critical)

- Ignore `/Users/trey/Desktop/Apps/SH/shiphawk-dev` for all requests scoped to `/Users/trey/Desktop/Apps`.
- Do not read, search, edit, or run commands in `shiphawk-dev` unless the user explicitly directs work there.
- If a request references "all apps" or "/Apps", treat `shiphawk-dev` as out of scope by default.

## Instruction File Mechanism (Critical)

- At every level (workspace, project, standalone app), `AGENTS.md` is the canonical shared instruction file. The sibling `CLAUDE.md` contains only `@AGENTS.md` plus Claude-specific extras below the import.
- Never duplicate content between the pair. A rule change goes into `AGENTS.md` once; the import keeps both tools current.
- Claude-only guidance belongs below the import in `CLAUDE.md` or in `.claude/rules/` (path-scoped rule files).
- Codex loads `AGENTS.md` files from broad to specific, ending at the working directory; project rules override workspace defaults for that subtree. Place specialized rules in the nearest project-level `AGENTS.md`.

## Workspace Overview

Multi-project workspace. Each subdirectory is an independent project with its own stack and its own `AGENTS.md`/`CLAUDE.md`. Always check the project-level instructions first when working in a subdirectory.

| Project | Description |
|---------|-------------|
| `MyLife/` | Unified hub app: 40+ privacy-first registry modules + standalone apps (BestChef, DoWork, Manhattan, Meerkat) on iOS, Android, Web |
| `FlashCards/` | Standalone spaced-repetition app (own git repo, Expo + local SQLite) extracted from MyLife flash; Chinese dual-axis SRS + stroke writing quiz |
| `TrainWithRyan/` | Single-trainer workout app (own git repo, Expo + Supabase) forked from DoWork |
| `automation-hub/` | Multi-channel task automation engine (email, calendar, Slack, iMessage) |
| `SH/shiphawk-dev/` | Rails shipping platform (out of scope by default) |
| `Parks/EasyStreet/` | Street sweeping parking app (native iOS + Android) |
| `Parks/easystreet-monorepo/` | EasyStreet cross-platform (Expo + Next.js) |
| `receipts/` | Receipt verification platform (Django + React) |
| `SH/shiphawk-templates/` | Liquid-templated shipping document templates |
| `tron-castle-fight/` | Browser RTS game (vanilla JS + Canvas 2D) |
| `system-monitor/` | macOS system monitor daemon (Node.js + launchd) |
| `mylife-talk/` | MyTalk voice copilot for Claude Code sessions (Node + Swift, codex brain, on-device speech) |
| `fed-memes/` | GIF/meme platform (Django + Swift + discord.js) |
| `MySurf/` | Surf forecasting app (Expo + Next.js + Supabase) |
| `MyBudget/` | Envelope budgeting app (Expo + Next.js + SQLite) |
| `MyBooks/` | Book tracking app (Expo + Next.js + SQLite) |
| `macos-hub/` | Retired MCP server (reference only) |
| `arenalite/` | Browser-based arena PvP prototype (TS + Three.js, deterministic sim over Arena's ability JSON) |

## Directory Creation Guardrail (Critical)

- Never create ad-hoc directories at the `/Apps/` root for staging, scaffolding, or PR preparation.
- The only valid pattern for sibling working directories is git worktrees: `../Apps-wt-[plan-name]` (via `cmux` or the plan queue scripts).
- Edit standalone submodule directories in place. Do not create copies or parallel trees.
- Any new directory at the `/Apps/` root must be a real project or group directory, not a transient workspace.

## Workspace Standards

- Every project must have: `AGENTS.md` (with a `CLAUDE.md` import stub), a change tracking file (`timeline.md` or `PROJECT_LOG.md`), and `README.md`.
- **Naming:** project directories lowercase-with-hyphens; group directories PascalCase (`Parks/`, `SH/`); reports `REPORT-<project>-YYYY-MM-DD.md`.
- Follow each project's git workflow and validation commands before declaring work complete. Keep docs in sync when public workflows, APIs, or templates change.

## Context7 - Live Documentation

When writing code that uses external libraries, use Context7 MCP tools to fetch current docs instead of relying on training data. Call `resolve-library-id` then `query-docs`, or skip resolution with these pre-resolved IDs:

| Project | Library IDs |
|---------|-------------|
| **MySurf** | `/vercel/next.js` (v15), `/supabase/supabase-js`, `/expo/expo`, `/colinhacks/zod`, `/rnmapbox/maps` |
| **MyBudget / MyBooks / easystreet-monorepo** | `/expo/expo`, `/vercel/next.js` (v15), `/colinhacks/zod` |
| **receipts** | `/djangoproject/django`, `/mantinedev/mantine`, `/reduxjs/redux-toolkit` |
| **fed-memes** | `/djangoproject/django`, `/meilisearch/meilisearch` |
| **automation-hub / system-monitor** | `/colinhacks/zod` |

Skip Context7 for pure business logic, markdown/YAML, vanilla JS/TS, and tron-castle-fight.

## Cross-Project Notes

- EasyStreet (native) and easystreet-monorepo share sweepingRuleEngine and holidayCalculator logic. Verify domain changes against both.
- ShipHawk ecosystem: shiphawk-templates produces templates consumed by shiphawk-dev; keep canonical field names aligned with `config/reference-fields/standard-fields.json`.
- Git conventions vary by project: ShipHawk uses Jira-linked branches, Receeps/MySurf/MyBudget/MyBooks use Conventional Commits, EasyStreet uses `feature/`/`bugfix/` prefixes.
- `macos-hub` is retired as an MCP server (2026-03-23); macOS integrations use cloud MCP servers instead.

## Workspace Skills

- `/research-app`, `/onboard-new-app`, `/research-documentation`, `/daily-report-ops`, `/generate-architecture-diagrams`, `/scan-emails`, `/dispatch` -- definitions under `.claude/skills/`.
- Marketing: 25 skills at `.claude/skills/marketing/`. Registry: `.claude/skills/SKILLS_REGISTRY.md`.

## Plan Queue Protocol

Plans are markdown files driving parallel Claude Code and Codex agents. Full protocol: `docs/guides/parallel-agent-orchestration.md` (canonical), dispatch algorithm in `.claude/skills/dispatch/SKILL.md`.

- Plans live in `docs/plans/{queue,active,done,failed}/`; move between states, never delete. Execution logs to `docs/plans/logs/`.
- Always start from `docs/plans/templates/plan-template.md`. Name: `[01-05]-[project]-[description].md` (lower number = higher priority).
- Before dispatch: check `active/` for in-flight plans, enforce dependencies against `done/`, and check scope overlap (hard conflict: same file; soft: parent/child directory).
- Execution: read the full plan first, complete phases in order unless `parallel: true`, never modify files outside declared Scope, move to `failed/` with a `## Blockers` section when blocked.
- Worktrees: `../Apps-wt-[plan-name]`, branch `plan/[plan-name]`, lifecycle via `cmux new|merge|rm`.
- Strategy selection (auto via `/dispatch`): overlapping same-project plans get an Agent Team; independent plans get parallel subagents; single/trivial work gets one subagent.
- Codex parity: Codex follows the same dispatch algorithm, dependency checks, scope guardrails, and queue state transitions; use the queue runner scripts when team tooling is unavailable.

## Custom Agent Definitions

Reusable roles in `.claude/agents/`: `plan-executor` (implementation), `test-writer` (tests only), `docs-agent` (docs only), `reviewer` (read-only review).

## Documentation Index

- `/Apps/docs/` central hub: `guides/` (plugin, MCP, tool, skill guides), `reports/` (research reports), `plans/` (implementation plans + queue), `timeline.md` (workspace action log).

## Writing Style

- Do not use em dashes in documents or writing.

## Instruction Writing (Critical)

Any instructions written for a human to follow (guides, runbooks, founder-ops steps, handoffs,
onboarding, "next steps" in chat) MUST be explicit enough for **someone brand new to the project
who has never seen the tool before**. Concision applies to explanation, never to steps.

Every step states, in this order:

1. **Where.** A full clickable URL, or the app plus the exact navigation path using the real
   on-screen labels (`App Store Connect > TestFlight > Builds > iOS > 1.0.0 (17)`). Never "go to
   the build page"; say which page and how to reach it from a known starting point.
2. **What you will see.** The literal on-screen text of the control, quoted, so the reader can
   confirm they are in the right place before acting.
3. **What to click or type.** Exact label, exact value; for radios and dropdowns, the exact
   option wording.
4. **What happens next**, including intermediate screens and dialog titles.
5. **Done when.** An observable end state the reader can verify.
6. **If it fails.** The likely cause and next move, for steps that commonly fail.

Also required: expand jargon on first use; numbered steps with one action each; say who does it
(founder vs agent) and flag what an agent cannot do (entering credentials, creating accounts,
financial or legal decisions); prefer doing the task over describing it when tooling allows, then
document what was done; reread as a stranger before shipping.

## Code Intelligence

Prefer LSP over Grep/Read for code navigation - it's faster, precise, and avoids reading entire files:

- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config). After writing or editing code, check LSP diagnostics and fix errors before proceeding.
