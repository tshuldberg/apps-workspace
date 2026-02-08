# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope Guardrail (Critical)

- Ignore `/Users/trey/Desktop/Apps/SH/shiphawk-dev` for all requests scoped to `/Users/trey/Desktop/Apps`.
- Do not read, search, edit, or run commands in `shiphawk-dev` unless the user explicitly directs work to `/Users/trey/Desktop/Apps/SH/shiphawk-dev`.
- If a request references "all apps" or "/Apps", treat `shiphawk-dev` as out of scope by default.

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

**Architecture:** 29 tools organized by app: Reminders (6), Notes (6), Calendar (6), Mail (5), System (3), Watcher (1), Keybindings (2). Bridges layer handles AppleScript via osascript. Config-driven via `config/watchers.json` and `config/keybindings.json`. MCP resources: `macos://changes/recent` (polling) and `macos://keybindings`.

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

## Cross-Project Patterns

- **Timeline tracking:** EasyStreet, easystreet-monorepo, receipts, shiphawk-templates, and tron-castle-fight all maintain change tracking files (`timeline.md` or `PROJECT_LOG.md`). Update these after completing work.
- **Project-level CLAUDE.md:** macos-hub, shiphawk-templates, tron-castle-fight, EasyStreet, easystreet-monorepo, and receipts each have their own CLAUDE.md with project-specific rules. Always defer to those when working within a project.
- **Git conventions vary by project:** ShipHawk uses Jira-linked branches (`vs-DEV-12345-*`), Receeps uses Conventional Commits, EasyStreet uses `feature/`/`bugfix/` prefixes, tron-castle-fight uses PROJECT_LOG.md entries.
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

### Directory Structure Standards
- Group related projects in subdirectories (e.g., `Parks/` for EasyStreet variants, `SH/` for ShipHawk ecosystem)
- New groups follow the pattern: `/Apps/<GroupName>/<ProjectName>/`
- Standalone projects sit at `/Apps/<ProjectName>/`
- Workspace-level documentation lives in `/Apps/docs/`

### Naming Conventions
- **Project directories:** lowercase-with-hyphens (`my-project`)
- **Group directories:** PascalCase for product families (`Parks/`, `SH/`)
- **Documentation files:** PascalCase for proper-noun files (`CLAUDE.md`, `README.md`), lowercase-with-hyphens for content files (`timeline.md`)
- **Reports:** `<project>-<type>-<YYYY-MM-DD>.md`

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

### Reference Documents
- `codex-self-sufficient-skillops-guide.md` — Autonomous AI agent system setup
- `Mac-Keyboard-Shortcuts.md` — macOS keyboard shortcuts
- `Mac-Window-Tiling-Shortcuts.md` — macOS window tiling (Control+Globe)
- `Tmux-Cheatsheet.md` — Tmux commands and workflows
