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

### macos-hub — macOS Integration MCP Server
Personal macOS integration hub giving Claude Code direct access to native Apple apps via AppleScript. Has its own CLAUDE.md.

**Stack:** Node.js (ES modules), TypeScript 5.9, MCP SDK 1.18.1 (stdio transport), Zod 3.24, osascript (AppleScript)

**Key commands:**
```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Run with tsx (dev mode)
npm start              # Run compiled JS
```

**Architecture:** 32 tools organized by app: Reminders (6), Notes (6), Calendar (6), Mail (5), Messages (3), System (3), Watcher (1), Keybindings (2). Bridges layer handles AppleScript via osascript. Config-driven via `config/watchers.json` and `config/keybindings.json`. MCP resources: `macos://changes/recent` (polling) and `macos://keybindings`.

---

### automation-hub — Multi-Channel Task Automation Engine
Standalone automation engine that consolidates email, calendar, reminders, iMessage, and Slack into a unified task pipeline with approval gates. Has its own CLAUDE.md.

**Stack:** Node.js (ES modules), TypeScript 5.9, Zod 3.24, Vitest, YAML job specs

**Key commands:**
```bash
npm run build                              # Compile TypeScript to dist/
npm test                                   # Run all tests (vitest)
npm run job:email-triage:dry-run           # Job 01: email triage
npm run job:due-date-planner:dry-run       # Job 02: due date planner
npm run job:gantt-drift:dry-run            # Job 03: gantt drift voice queue
npm run job:channel-consolidation:dry-run  # Job 04: unified channel consolidation
```

**Architecture:** Adapter pattern with 7 adapters (Slack, iMessage, Mail, Calendar, Reminders, PM, Mock) implementing a shared `ChannelAdapter` interface. `ChannelRouter` routes responses to the originating channel. 4 job runners driven by YAML specs. Approval gate enforces human-in-the-loop for all write actions. `AdapterKit` factory creates mock adapters for dry-run and real adapters for production. Run artifacts written to `runs/<run_id>/`.

---

### shiphawk-dev — Rails Shipping Platform (Ignored by Default)
Large-scale Ruby on Rails 8.0 application for shipping and logistics management.

Status: Out of scope unless the user explicitly requests work in `/Users/trey/Desktop/Apps/SH/shiphawk-dev`.

**Stack:** Ruby 3.4.2, Rails 8.0, PostgreSQL, Redis, Elasticsearch, Sidekiq (Pro/Enterprise), Grape API, ActiveAdmin, Unicorn

**Key commands:**
```bash
bundle exec rspec                           # Run all tests
bundle exec rspec spec/path/to/spec.rb      # Run single test file
bundle exec rspec spec/path/to/spec.rb:42   # Run single example at line
bundle exec rubocop                         # Lint
bundle exec rails s                         # Dev server
docker-compose up                           # Full dev stack (Postgres, Redis, ES, app)
```

**Architecture:** 257 models, 175 services, 87 Sidekiq workers. Uses service objects pattern (`app/services/`), Grape API (`app/api/`), query objects (`app/queries/`), presenters, and serializers. Two databases: main app schema (`db/schema.rb`) and PMS (Products Micro-Service, `db/pms_schema.rb` with `PMS_DATABASE_URL`).

**Testing conventions:** RSpec with FactoryBot (217 factories). Custom metatags: `freezed_time`, `enable_elasticsearch`, `sidekiq`, `env`, `disable_threads`, `disable_pms`, `disable_bullet`, `vcr`. VCR cassettes for HTTP mocking. CI runs 10 parallel test slices.

**Git workflow:** Branch format `vs-DEV-12345-short-description`, commit format `[DEV-12345] description`. Branches: qa -> rc -> master -> stable. See `doc/shiphawk_development_guideline.md`.

**Documentation:** `doc/testing.md` (RSpec metatags, VCR, seeds), `doc/install-osx.md`, `doc/elasticsearch.md`, `doc/migrations.md`, `doc/seed-db.md`.

---

### EasyStreet — Street Sweeping Parking App (Native)
Dual-platform mobile app (iOS + Android) for San Francisco street sweeping schedules. Has its own CLAUDE.md at `.claude/CLAUDE.md`.

**Stack:** iOS (Swift/UIKit, MapKit, SQLite), Android (Kotlin/Jetpack Compose, Google Maps)

**Key commands:**
```bash
# iOS
xcodebuild -project EasyStreet/EasyStreet.xcodeproj -scheme EasyStreet -sdk iphonesimulator build
xcodebuild test -project EasyStreet/EasyStreet.xcodeproj -scheme EasyStreet -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15'
cd EasyStreet && xcodegen generate          # Regenerate project after file changes

# Android
cd EasyStreet_Android && ./gradlew build
cd EasyStreet_Android && ./gradlew test
```

**Architecture:** MVC (iOS) / MVVM (Android). Core business logic in SweepingRuleEngine and HolidayCalculator (11 SF public holidays, dynamically computed). SQLite database with 37,856 street segments. 13 iOS test files in `EasyStreetTests/`.

---

### easystreet-monorepo — Street Sweeping App (Cross-Platform)
Monorepo version of EasyStreet using web technologies. Has its own CLAUDE.md at `.claude/CLAUDE.md`.

**Stack:** TypeScript, Bun 1.2.4, Turborepo, Expo (React Native), Next.js 15, Convex (serverless backend), Vitest

**Key commands:**
```bash
bun run dev              # All apps
bun run dev:web          # Web only (Next.js + turbopack)
bun run dev:mobile       # Mobile only (Expo)
bun run dev:backend      # Convex dev server
bun run build            # Build all
bun run test             # Test all (Vitest for shared package)
bun run lint             # Lint all
bun run typecheck        # Type check all
```

**Architecture:** `apps/web/` (Next.js 15, MapLibre GL), `apps/mobile/` (Expo, React Native), `packages/backend/` (Convex schema, functions), `packages/shared/` (sweepingRuleEngine, holidayCalculator, types — shared across platforms), `packages/eslint-config/`, `packages/typescript-config/`.

---

### receipts — Receipt Verification Platform (Receeps)
Django REST API + React SPA for receipt-based evidence verification. Has its own CLAUDE.md.

**Stack:** Django 4.x, DRF, Celery, PostgreSQL, React (Vite), Mantine v8.1.1, Redux Toolkit

**Key commands:**
```bash
# Backend
poetry install && python3 manage.py migrate
python3 manage.py runserver               # Dev server (port 8000)
python3 manage.py test                    # Run tests
black . && isort .                        # Format
flake8 .                                  # Lint

# Frontend
cd frontend && npm install
npm run dev                               # Dev server (port 5173)
npm run build                             # Production build
npm run lint && npm test                  # Lint + test
```

**Architecture:** `accounts/` (auth, profiles, shared serializers), `app/` (Topic, Item, Conclusion), `receipt/` (receipts, votes, verification), `comments/`, `notifications/`, `frontend/` (React SPA). Uses `BaseModel` from `util/base_model/`, shared cache utils from `util/cache_utils.py`, example templates in `util/examples/`.

**Key rules:** Use Mantine components + `@tabler/icons-react` only. Use Axios wrapper (never `fetch()`). Use `dayjs` (never `date-fns`). Use CSS variables `var(--reddit-*)` (never hardcode hex). Use `UserBriefSerializer` from accounts (never duplicate). Call `invalidate_*_cache()` after every mutation. Serializers use directory convention (`list/`, `detail/`).

**Git workflow:** Conventional Commits, squash merge to `main`, branch naming `feature/`, `fix/`, `refactor/`, `docs/`. Supports git worktrees for parallel development.

---

### shiphawk-templates — Shipping Document Templates
Liquid-templated HTML packing slips and JSON label configs for 20+ customers.

**Stack:** HTML with Liquid templating, JSON configs. No build step.

**Key constraint:** Templates MUST use table-based layout with inline styles (no div/CSS — ShipHawk's PDF renderer requires it).

**Structure:** `templates/packing-slips/customers/[name]/`, `templates/labels/carton-labels/customers/[name]/`, `config/reference-fields/standard-fields.json` (canonical field names). Label font sizes limited to: `[12, 17, 22, 28, 33, 44, 67, 100, 111, 133, 150, 170, 190, 220]`.

**Workflow:** Match customer to visual pattern (`docs/visual-reference/README.md`), copy base template, customize, test with 1/15/30+ items.

---

### tron-castle-fight — Neon Castle Clash (Browser RTS Game)
Browser-based real-time strategy game with Tron aesthetic. Has its own CLAUDE.md.

**Stack:** Vanilla HTML/CSS/JS, Canvas 2D, Node.js WebSocket server (multiplayer only)

**Key commands:**
```bash
open index.html                            # Single-player (no server needed)
npm install && npm start                   # Multiplayer (WebSocket server on :8080)
```

**Architecture:** Single-file engine (`game.js`, ~1861 lines). No classes — plain objects with `entityType`/`side` fields. Single mutable `state` object reset by `initGame()`. Config-driven balance via `UNIT_DEFS`, `BUILDING_DEFS`, `POWERUPS`, `GAME` constants. Multiplayer uses authoritative server (`server/server.js`).

**Governance:** Maintains `PROJECT_LOG.md` with structured entries for every change session. See `AGENTS.md` for required log fields.

---

### system-monitor — macOS System Monitor Daemon
24/7 background daemon monitoring CPU, memory, and disk usage. Generates markdown reports with process snapshots on threshold breaches, sends native macOS notifications, logs history for trend analysis. Has its own CLAUDE.md.

**Stack:** Node.js (ES modules), TypeScript 5.9, Zod 3.24, launchd agent

**Key commands:**
```bash
npm run build            # Compile TypeScript to dist/
npm run dev              # Run with tsx (dev mode)
npm run install-daemon   # Build + install launchd agent
npm run uninstall-daemon # Stop + remove launchd agent
npm run test             # Test collectors
```

**Architecture:** Collectors parse `top`/`vm_stat`/`df` output into typed snapshots. AlertEvaluator tracks sustained breaches (CPU) and pressure levels (memory) with cooldown state machine. Reports written to `docs/reports/REPORT-system-monitor-YYYY-MM-DD.md`. JSONL history logged to `logs/history.jsonl` with rotation. Config-driven via `config/monitor.json`.

---

### fed-memes — Federal Reserve of Memes (GIF/Meme Platform)
GIF and meme platform replacing Tenor (shutting down) and competing with Giphy. MVP is an iMessage extension. Has its own CLAUDE.md.

**Stack:** Python 3.12, Django 5.x, DRF, PostgreSQL, Redis, Celery, Meilisearch, Cloudflare R2 + CDN, Swift/UIKit (iOS), TypeScript/discord.js (bot)

**Key commands:**
```bash
# Backend
make dev                                 # Start full dev stack
make test                                # Run tests
python manage.py runserver               # Dev server

# iOS
cd FedMemes && xcodegen generate         # Generate Xcode project
```

**Architecture:** 7-stage implementation plan. Backend API (Django/DRF), iMessage extension (Swift/UIKit), content pipeline (Celery + FFmpeg), search engine (Meilisearch), Discord bot (discord.js), iOS keyboard extension, public API + web SDK. Implementation plan in `docs/plan/`.

---

## Cross-Project Patterns

- **Timeline tracking:** EasyStreet, easystreet-monorepo, receipts, shiphawk-templates, tron-castle-fight, system-monitor, and fed-memes all maintain change tracking files (`timeline.md` or `PROJECT_LOG.md`). Update these after completing work.
- **Project-level CLAUDE.md:** macos-hub, shiphawk-templates, tron-castle-fight, EasyStreet, easystreet-monorepo, receipts, system-monitor, and fed-memes each have their own CLAUDE.md with project-specific rules. Always defer to those when working within a project.
- **Git conventions vary by project:** ShipHawk uses Jira-linked branches (`vs-DEV-12345-*`), Receeps uses Conventional Commits, EasyStreet uses `feature/`/`bugfix/` prefixes, tron-castle-fight uses PROJECT_LOG.md entries, fed-memes uses Conventional Commits.
- **Shared business logic:** EasyStreet (native) and easystreet-monorepo share the sweepingRuleEngine and holidayCalculator concepts. Changes to holiday logic or sweeping rules in one should be verified against the other.
- **ShipHawk ecosystem:** shiphawk-templates produces templates consumed by shiphawk-dev. Template variable references must align with shiphawk-dev's data schema.
- **macOS Hub MCP server:** macos-hub provides MCP tools used by Claude Code across all projects. Changes to its tool interface affect all projects that use those tools.

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

### CLAUDE.md Quality Tiers

**Tier 1 (Minimum):** Overview, Stack, Key Commands, Architecture, Git Workflow. Template: `docs/templates/claude-md-minimum.md`

**Tier 2 (Standard):** Tier 1 plus Testing, Code Style, Environment Setup, Important Notes, change tracking file. Template: `docs/templates/claude-md-standard.md`

**Tier 3 (Mature):** Tier 2 plus `.claude/docs/` with architecture docs, custom skills with SKILLS_REGISTRY.md, plugin inventory, development tracking rules.

| Project | Current Tier | Target Tier |
|---------|-------------|-------------|
| receipts | 3 | 3 |
| EasyStreet (native) | 3 | 3 |
| easystreet-monorepo | 2 | 2 |
| macos-hub | 1 | 2 |
| shiphawk-templates | 2 | 2 |
| tron-castle-fight | 2 | 2 |
| system-monitor | 2 | 2 |
| fed-memes | 2 | 3 |

### Directory Structure Standards
- Group related projects in subdirectories (e.g., `Parks/` for EasyStreet variants, `SH/` for ShipHawk ecosystem)
- New groups follow the pattern: `/Apps/<GroupName>/<ProjectName>/`
- Standalone projects sit at `/Apps/<ProjectName>/`
- Workspace-level documentation lives in `/Apps/docs/`

### Naming Conventions
- **Project directories:** lowercase-with-hyphens (`my-project`)
- **Group directories:** PascalCase for product families (`Parks/`, `SH/`)
- **Documentation files:** PascalCase for proper-noun files (`CLAUDE.md`, `README.md`), lowercase-with-hyphens for content files (`timeline.md`)
- **Reports:** `REPORT-<project>-YYYY-MM-DD.md` (project slug + date for readability from any folder)

## Documentation Index

### Workspace-Level
- `/Apps/docs/` — Central documentation hub ([index](docs/README.md))
- `/Apps/docs/guides/` — Plugin, MCP server, tool, and skill user guides
- `/Apps/docs/reports/` — Research reports and analysis outputs
- `/Apps/docs/plans/` — Workspace-level implementation plans
- `/Apps/docs/templates/` — Reusable templates (CLAUDE.md, timeline, guides, reports)
- `/Apps/timeline.md` — Workspace-level action log

### Workspace Skills
- `/research-app` — Analyze an app codebase and generate a structured research report
- `/onboard-new-app` — Onboard a new application into the workspace (generates docs, updates root index, runs research)
- `/research-documentation` — Research official documentation and produce cited implementation guidance
- `/daily-report-ops` — Generate daily/ad-hoc reports with strict naming and triage stale/conflicting PRs
- `/generate-architecture-diagrams` — Generate mermaid erDiagram + flowchart for a project's data models and system architecture, saved to `.claude/docs/`
- `/scan-emails` — Scan an email inbox via macos-hub MCP mail tools, categorize unread messages by type/priority, and build an actionable task list
- `/dispatch` — Intelligently dispatch plans from `docs/plans/queue/` using auto-selected strategy (Agent Teams for coordinated same-project work, parallel subagents for independent cross-project work)

### Marketing Skills (via [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills))
25 skills installed at `.claude/skills/marketing/`. Full registry: `.claude/skills/SKILLS_REGISTRY.md`. Applicability report: `docs/reports/marketing-skills-applicability.md`.

**CRO:** `/marketing/page-cro`, `/marketing/signup-flow-cro`, `/marketing/onboarding-cro`, `/marketing/form-cro`, `/marketing/popup-cro`, `/marketing/paywall-upgrade-cro`
**Content:** `/marketing/copywriting`, `/marketing/copy-editing`, `/marketing/email-sequence`, `/marketing/social-content`, `/marketing/content-strategy`
**SEO:** `/marketing/seo-audit`, `/marketing/programmatic-seo`, `/marketing/competitor-alternatives`, `/marketing/schema-markup`
**Measurement:** `/marketing/analytics-tracking`, `/marketing/ab-test-setup`
**Ads:** `/marketing/paid-ads`
**Strategy:** `/marketing/marketing-ideas`, `/marketing/marketing-psychology`, `/marketing/launch-strategy`, `/marketing/pricing-strategy`, `/marketing/free-tool-strategy`, `/marketing/referral-program`, `/marketing/product-marketing-context`

### Reference Documents
- `docs/guides/codex-self-sufficient-skillops-guide.md` — Autonomous AI agent system setup
- `docs/guides/Mac-Keyboard-Shortcuts.md` — macOS keyboard shortcuts
- `docs/guides/Mac-Window-Tiling-Shortcuts.md` — macOS window tiling (Control+Globe)
- `docs/guides/Tmux-Cheatsheet.md` — Tmux commands and workflows
- `docs/guides/Notion-Practical-Guide.md` — Notion setup and workflow guide
- `docs/guides/text-editing-shortcuts.md` — macOS + Claude Code text editing shortcuts
- `docs/guides/parallel-agent-orchestration.md` — Plan queue system, worktree management, dispatch workflows, and scaling to 8+ agents

## Plan Queue Protocol

### Overview
The workspace uses a plan-file queue system to drive parallel Claude Code agents. Plans are markdown files that describe self-contained units of work. Agents pick up plans from the queue, execute them, and move them to done/failed.

### Directory Structure
```
docs/plans/
  queue/           ← Plans waiting for execution (prioritized by filename prefix)
  active/          ← Currently being executed
  done/            ← Completed plans (archive)
  failed/          ← Plans that hit blockers
  templates/       ← Reusable plan templates
  logs/            ← Execution logs (JSON)
  scripts/         ← Queue runner scripts
```

### Plan File Naming
```
[priority]-[project]-[brief-description].md
01-receipts-api-pagination.md
02-fed-memes-imessage-scaffold.md
03-tron-castle-fight-balance-pass.md
```
Priority 01-05, lower = higher priority. Files sort naturally by priority.

### Plan File Format
Every plan file must contain at minimum:
1. **Metadata** — Project, priority, effort, dependencies, worktree flag
2. **Objective** — 1-3 sentences on what this accomplishes
3. **Scope** — Explicit list of files/dirs affected AND files not to touch
4. **Phases** — Ordered checklist of steps with acceptance criteria per phase
5. **Acceptance Criteria** — How to verify the plan is fully complete
6. **Constraints** — Guardrails (files off-limits, conventions to follow)

**Template (mandatory):** Always start new plans by copying `docs/plans/templates/plan-template.md`. Do not write plans from scratch — use the template and fill in each section. Plans should be detailed enough to make all requirements unambiguous to an agent working without access to the original conversation. Include specific file paths, expected behavior, edge cases, and concrete acceptance criteria. A good plan leaves no room for interpretation — the executing agent should never need to guess what you meant.

### Execution Rules
- Read the full plan before starting any work
- Complete phases in order unless explicitly marked `parallel: true`
- After each phase, check off completed items in the plan
- If blocked, add a `## Blockers` section, move plan to `failed/`, and stop
- Do NOT modify files outside the declared Scope
- Follow the target project's CLAUDE.md conventions

### Queue Runners
- **Sequential:** `./docs/plans/scripts/plan-runner.sh` — processes plans one at a time via `claude -p`
- **Parallel:** `./docs/plans/scripts/parallel-plan-runner.sh [max-concurrent]` — creates git worktrees per plan, runs up to N agents simultaneously

### Worktree Conventions
- Worktree directories: `../Apps-wt-[plan-name]` (sibling to main checkout)
- Branch naming: `plan/[plan-name]` (matches the plan filename without extension)
- After completion, worktrees are removed but branches are preserved for review
- Use `cmux` for interactive worktree management: `cmux new [name]`, `cmux merge [name]`, `cmux rm [name]`

### Agent Teams
Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`.

**When to use Agent Teams vs Subagents:**

| Scenario | Strategy |
|----------|----------|
| 2+ plans target the same project with overlapping scope | **Agent Team** — lead coordinates, teammates own file zones |
| Plans target different projects, no overlap | **Parallel Subagents** — independent, fire-and-forget |
| Single plan or trivial standalone work | **Single Subagent** — simplest path |
| Research/exploration tasks | **Background Subagents** — `run_in_background: true` |

**Team composition:** Lead (coordinator, delegate mode) + specialized teammates. Size tasks at 5-6 per teammate. Each teammate owns different files (use project CLAUDE.md file ownership zones).

**`/dispatch` selects strategy automatically** — groups plans by project, checks for file conflicts, and chooses Team vs Subagent accordingly. Use `--strategy team|subagent` to override.

### Custom Agent Definitions
Reusable agent roles defined in `.claude/agents/`:

| Agent | Role | Edits Files? |
|-------|------|-------------|
| `plan-executor` | Execute plan phases with testing and verification | Yes |
| `test-writer` | Write tests without modifying source code | Tests only |
| `docs-agent` | Update documentation (CLAUDE.md, timeline, diagrams) | Docs only |
| `reviewer` | Read-only code review, quality gates | No |

Use as `subagent_type` when spawning teammates or subagents. Prefer specialized agents over `general-purpose` when the role matches.

## Operational Patterns

### Writing Plans
- Always copy `docs/plans/templates/plan-template.md` as the starting point for any new plan
- Name: `[01-05]-[project]-[description].md` — priority prefix controls execution order
- Include the `superpowers:executing-plans` sub-skill directive in the plan header
- Scope section must list exact files/dirs; agents will refuse to touch files outside Scope
- Plans should be thorough and self-contained — include specific file paths, code patterns to follow, expected behavior, edge cases, and concrete acceptance criteria so the executing agent never needs to guess intent

### Parallel Agent Work
- Use `cmux` for worktree lifecycle: `cmux new [name]`, `cmux merge [name]`, `cmux rm [name]`
- Use `/dispatch` to preview and fire the plan queue interactively
- Use `./docs/plans/scripts/parallel-plan-runner.sh [N]` for unattended batch execution
- Use Agent Teams for coordinated same-project work (2+ plans touching the same project with overlapping scopes)
- Use parallel subagents for independent cross-project plans with no file overlap
- `/dispatch` auto-selects the best strategy — groups by project, checks scope conflicts, recommends Team vs Subagent
- Custom agent types in `.claude/agents/` (plan-executor, test-writer, docs-agent, reviewer) — use as `subagent_type` for scoped work
- Check each project's "Parallel Agent Work" section in its CLAUDE.md for file ownership boundaries before assigning parallel tasks

### Background Research Pattern
- For research-heavy tasks, spawn background agents with `run_in_background: true`
- Collect results after completion rather than blocking
- Multiple research agents can run concurrently on different questions

### Headless Execution
- `claude -p "[prompt]"` runs Claude Code without an interactive terminal
- `--allowedTools "Read,Edit,Write,Bash,Glob,Grep"` controls what headless agents can do
- `--output-format json` captures structured logs
- Queue runner scripts use this pattern; see `docs/plans/scripts/`

## Interaction Style Requirements

### Explanatory Output Mode
Every session should use the **explanatory output style**. Before and after writing code or completing significant work, provide brief educational insights using this format:

```
`★ Insight ─────────────────────────────────────`
[2-3 key educational points specific to the codebase or the work just done]
`─────────────────────────────────────────────────`
```

Focus on insights that are:
- Specific to this codebase, not general programming concepts
- Relevant to the task at hand
- Helpful for understanding architectural decisions or trade-offs

### Proactive User Check-Ins (AskUserQuestion)
Use the `AskUserQuestion` tool frequently to:
- **Clarify ambiguous requirements** before starting work (not after)
- **Offer implementation choices** when multiple valid approaches exist
- **Confirm direction** on multi-step tasks before proceeding to the next phase
- **Surface trade-offs** when a decision has meaningful consequences

Do not wait until work is complete to discover misalignment. Check in early and often. Prefer 2-option questions with a recommended default when possible.
