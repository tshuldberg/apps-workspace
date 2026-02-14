# AGENTS.md

Workspace-wide agent instructions for `/Users/trey/Desktop/Apps`.

## Scope Guardrail (Critical)

- Ignore `/Users/trey/Desktop/Apps/SH/shiphawk-dev` for all requests scoped to `/Users/trey/Desktop/Apps`.
- Do not read, search, edit, or run commands in `shiphawk-dev` unless the user explicitly directs work to `/Users/trey/Desktop/Apps/SH/shiphawk-dev`.
- When a request references "all apps" or "/Apps", always treat `shiphawk-dev` as out of scope by default.

## Instruction Sync (Critical)

- When adding, removing, or changing a persistent rule in this workspace, update both:
  - `/Users/trey/Desktop/Apps/AGENTS.md`
  - `/Users/trey/Desktop/Apps/CLAUDE.md`
- Treat `AGENTS.md` and `CLAUDE.md` as a synchronized pair. A rule change is not complete until both files reflect it.
- For project-specific rule changes, apply the same sync rule in that project's instruction pair (`AGENTS.md` and `CLAUDE.md` or `.claude/CLAUDE.md`).

## Codex Instruction Layering

- Codex loads instruction files from broad to specific, ending at the current working directory.
- Place specialized rules in the nearest project-level `AGENTS.md`.
- If both root and project rules exist, project rules override workspace defaults for that subtree.

## Project Instruction Files

- Workspace root: `/Users/trey/Desktop/Apps/AGENTS.md`
- Receipts: `/Users/trey/Desktop/Apps/receipts/AGENTS.md`
- ShipHawk templates: `/Users/trey/Desktop/Apps/shiphawk-templates/AGENTS.md`
- macOS hub: `/Users/trey/Desktop/Apps/macos-hub/AGENTS.md`
- Tron Castle Fight: `/Users/trey/Desktop/Apps/tron-castle-fight/AGENTS.md`
- EasyStreet (native): `/Users/trey/Desktop/Apps/Parks/EasyStreet/AGENTS.md`
- EasyStreet (monorepo): `/Users/trey/Desktop/Apps/Parks/easystreet-monorepo/AGENTS.md`
- Fed Memes: `/Users/trey/Desktop/Apps/fed-memes/AGENTS.md`

## Workspace Standards

- Use each project's local `AGENTS.md` before editing that project.
- Keep project tracking artifacts up to date (`timeline.md` or `PROJECT_LOG.md`) when work changes behavior or architecture.
- Follow each project's git workflow and validation commands before declaring work complete.
- Keep documentation in sync with behavior changes when public workflows, APIs, or templates change.

## Cross-Project Notes

- EasyStreet native and EasyStreet monorepo share sweeping-domain logic concepts (rules, holidays, status mapping). Keep behavior consistent across both when changing domain logic.
- `shiphawk-templates` output is consumed by the ShipHawk ecosystem. Keep canonical field names aligned with `config/reference-fields/standard-fields.json`.
- `macos-hub` is an MCP server used across projects; interface changes can impact workflows outside its own repository.
- `fed-memes` (Federal Reserve of Memes) is a GIF/meme platform with a 7-stage implementation plan in `docs/plan/`. Backend uses Django/DRF (similar to receipts), iOS uses Swift/UIKit (similar to EasyStreet).

## Workspace Skills

- `/research-app` — Analyze an app codebase and generate a structured research report. File: `/Users/trey/Desktop/Apps/.claude/skills/research-app/SKILL.md`
- `/onboard-new-app` — Onboard a new app into `/Apps` and update workspace docs. File: `/Users/trey/Desktop/Apps/.claude/skills/onboard-new-app/SKILL.md`
- `/research-documentation` — Research official docs and produce cited guidance for instruction, tooling, and platform questions. File: `/Users/trey/Desktop/Apps/.claude/skills/research-documentation/SKILL.md`
- `/daily-report-ops` — Daily/ad-hoc reporting plus PR triage with strict naming rules. File: `/Users/trey/Desktop/Apps/.claude/skills/daily-report-ops/SKILL.md`
- `/generate-architecture-diagrams` — Generate mermaid erDiagram + flowchart for a project, saved to `.claude/docs/data-models.md` and referenced from CLAUDE.md. File: `/Users/trey/Desktop/Apps/.claude/skills/generate-architecture-diagrams/SKILL.md`
- `/scan-emails` — Scan an email inbox via macos-hub MCP mail tools, categorize unread messages by type/priority, and build an actionable task list. File: `/Users/trey/Desktop/Apps/.claude/skills/scan-emails/SKILL.md`
- `/dispatch` — Intelligently dispatch plans using auto-selected strategy (Agent Teams for same-project coordination, parallel subagents for independent work). File: `/Users/trey/Desktop/Apps/.claude/skills/dispatch/SKILL.md`

### Marketing Skills (via [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills))
25 skills installed at `.claude/skills/marketing/`. Full registry: `.claude/skills/SKILLS_REGISTRY.md`. Applicability report: `docs/reports/marketing-skills-applicability.md`.

**CRO:** `/marketing/page-cro`, `/marketing/signup-flow-cro`, `/marketing/onboarding-cro`, `/marketing/form-cro`, `/marketing/popup-cro`, `/marketing/paywall-upgrade-cro`
**Content:** `/marketing/copywriting`, `/marketing/copy-editing`, `/marketing/email-sequence`, `/marketing/social-content`, `/marketing/content-strategy`
**SEO:** `/marketing/seo-audit`, `/marketing/programmatic-seo`, `/marketing/competitor-alternatives`, `/marketing/schema-markup`
**Measurement:** `/marketing/analytics-tracking`, `/marketing/ab-test-setup`
**Ads:** `/marketing/paid-ads`
**Strategy:** `/marketing/marketing-ideas`, `/marketing/marketing-psychology`, `/marketing/launch-strategy`, `/marketing/pricing-strategy`, `/marketing/free-tool-strategy`, `/marketing/referral-program`, `/marketing/product-marketing-context`

## Plan Queue Protocol

### Overview
The workspace uses a plan-file queue system to drive parallel Claude Code agents. Plans are markdown files describing self-contained units of work. Agents pick up plans from the queue, execute them, and move them to done/failed.

### Directory Structure
- `docs/plans/queue/` — Plans waiting for execution (prioritized by filename prefix)
- `docs/plans/active/` — Currently being executed
- `docs/plans/done/` — Completed plans (archive)
- `docs/plans/failed/` — Plans that hit blockers
- `docs/plans/templates/` — Reusable plan templates (start from `plan-template.md`)
- `docs/plans/logs/` — Execution logs (JSON)
- `docs/plans/scripts/` — Queue runner scripts (`plan-runner.sh`, `parallel-plan-runner.sh`)

### Plan File Naming
Format: `[priority]-[project]-[brief-description].md` (e.g., `01-receipts-api-pagination.md`). Priority 01-05, lower = higher.

### Plan Template (Mandatory)
Always start new plans by copying `docs/plans/templates/plan-template.md`. Do not write plans from scratch. Plans must be detailed enough to make all requirements unambiguous — include specific file paths, expected behavior, edge cases, and concrete acceptance criteria so the executing agent never needs to guess intent.

### Execution Rules
- Read the full plan before starting any work
- Complete phases in order unless marked `parallel: true`
- Check off items as completed
- If blocked, add `## Blockers`, move plan to `failed/`, stop
- Do NOT modify files outside the declared Scope
- Follow target project's CLAUDE.md conventions

### Worktree Conventions
- Worktree dirs: `../Apps-wt-[plan-name]` (sibling to main checkout)
- Branch naming: `plan/[plan-name]`
- Use `cmux` for lifecycle management: `cmux new`, `cmux merge`, `cmux rm`
- Per-project bootstrap: `.cmux/setup` scripts handle env symlinks and dependency install

### Agent Teams
Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`.

**Strategy selection (auto via `/dispatch`):**
- 2+ plans same project with overlapping scope → **Agent Team** (lead + specialized teammates)
- Plans target different projects, no overlap → **Parallel Subagents** (independent)
- Single plan or trivial work → **Single Subagent**
- Research/exploration → **Background Subagents**

Team sizing: 5-6 tasks per teammate. Each teammate owns different files (use project CLAUDE.md file ownership zones).

### Custom Agent Definitions
Reusable agent roles in `.claude/agents/`: `plan-executor` (implementation), `test-writer` (tests only), `docs-agent` (docs only), `reviewer` (read-only review). Use as `subagent_type` when spawning teammates or subagents.

## Documentation Index

- Workspace docs root: `/Users/trey/Desktop/Apps/docs/`
- Guides: `/Users/trey/Desktop/Apps/docs/guides/`
- Plans: `/Users/trey/Desktop/Apps/docs/plans/`
- Reports: `/Users/trey/Desktop/Apps/docs/reports/`
- Parallel Agent Guide: `/Users/trey/Desktop/Apps/docs/guides/parallel-agent-orchestration.md`
