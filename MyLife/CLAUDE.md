# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MyLife is a unified hub app consolidating privacy-first personal app modules into a single cross-platform application. The registry currently defines 41 module IDs, with 38 full modules wired on mobile and 30 wired on web. Users enable or disable modules from a hub dashboard, funded by a suite subscription.

**Platforms:** iOS (Expo), Android (Expo), Web (Next.js 15), macOS (SwiftUI, future)
**Monetization:** Suite subscription via RevenueCat (mobile) + Stripe (web)

## Stack

- **Language:** TypeScript everywhere
- **Mobile:** Expo (React Native) via `apps/mobile/`
- **Web:** Next.js 15 (App Router) via `apps/web/`
- **Database:** SQLite (expo-sqlite mobile, better-sqlite3 web), single file, prefixed tables per module
- **Cloud Modules:** Supabase (MySurf, MyWorkouts), Drizzle + tRPC (MyHomes)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm 9.15.x
- **Validation:** Zod 3.24
- **Testing:** Vitest

## TypeScript Requirement

- TypeScript-first across all apps and packages in this project.
- New runtime code should be .ts/.tsx with strict typing and no implicit any.
- Use .js/.cjs only where required by tooling or platform constraints.

## Scope And Completeness (Critical)

- Founder mandate (2026-06-28): for MyLife and every contained project/standalone app, there are no time, phase, or scope limits on any release. Design and build every feature for full, production-grade function.
- Do not defer functionality with "later", "minimal slice", "MVP-only", "phase 2", "post-launch", "v1.1 scope", or "out of scope" framing. Build the complete feature.
- Everything ships together at full function unless the founder explicitly says otherwise. Do not silently drop, stub, or shrink a capability to save effort.
- When presenting options, never offer a deferred/minimal path as the recommendation; recommend the full-function path.
- This does not override the transport-honesty rule or other safety guardrails: build the full feature for real, never fake a capability that is not implemented.

## App Isolation + Hub Inclusion (Critical)

- Any app added to `/Users/trey/Desktop/Apps` must be either:
  - a fully isolated standalone app directory (for example `MyWords/`), or
  - a MyLife hub module wired inside `modules/<name>/` and `apps/mobile` and/or `apps/web`.
- If an app exists in both forms, keep the standalone app fully isolated in its own directory and keep hub integration inside MyLife module and app boundaries.
- Do not scatter standalone app files directly in the MyLife root.
- Directories under `archive/` are historical placeholders, not active standalone edit targets.

## Standalone And Module Parity (Critical)

- Active standalone apps are canonical product sources until they are explicitly archived.
- If an active standalone app also has a hub module, keep product intent aligned across both surfaces: feature set, behavior, data model intent, and user-facing terminology.
- Do not describe a hub module as parity-complete if it is still a lightweight adapter or partial migration.
- When a parity-impacting rule changes, update both instruction pairs (`AGENTS.md` and `CLAUDE.md`) in the same session.
- Use `pnpm check:module-parity`, `pnpm check:passthrough-parity`, `pnpm check:workouts-parity`, and `pnpm check:parity` for parity-impacting work.

## Mesh Sync (Critical)

- Decentralized mesh sync is a primary data communication layer for Meerkat (repo: MyLife).
- BestChef public launch exception: BestChef launch readiness must use a standard server-backed path for public users. Do not make local-only device communication, LAN/nearby peer transport, BLE, WebRTC, or mesh relay the launch-critical data path. Use Supabase Auth, Postgres/RLS, Storage, Edge Functions, and server-side jobs for public identity, media, social, moderation, provider calls, account deletion, and recovery. Local SQLite remains an offline cache, draft store, and optimistic UI layer only.
- **Multi-workspace:** Users can create and join multiple workspaces (personal, group, community). A personal workspace is auto-created at first launch. Each workspace has its own symmetric key, membership, and scope boundary.
- Transport ladder default is LAN-first: LAN Wi-Fi / Bonjour (`_mylife-sync._tcp`), then nearby peer (Apple Multipeer, Android Wi-Fi Direct), then BLE (wake-up pings only), WebRTC, encrypted relay. Relays forward ciphertext only, addressed by per-session ephemeral tokens (not device pubkeys) for metadata privacy.
- **Ranked-choice transport:** Each user ranks transport layers. When two peers connect, the selector intersects both preference lists and picks the highest mutual match. Falls through to default ladder order if no mutual candidate works.
- Every synced entity declares a scope: `device_local`, `personal_replica`, `shared_workspace`, `published_blob`. Per-entity `maxScope` caps prevent escalation (e.g., `sp_bets` stays `personal_replica` even if sports module is shareable). Security lives in the payload, not the channel.
- Existing substrate lives in `packages/sync/`. Extend it; do not parallel-wire new sync code.
- Full design: `docs/designs/mesh-sync-architecture.md`. Per-module policy matrix: `docs/designs/mesh-sync-module-policy-matrix.md`. Phased rollout: `docs/plans/queue/08-mesh-sync-mission-control.md`.
- Once Phase 0 lands, every new `ModuleDefinition` must declare a `syncPolicy`. Modules with `isSensitive: true` require fingerprint-compare pairing before `shared_workspace` scope is allowed. Modules with `requiresManualResolver: true` must register a `resolverComponent`.

## Agent Instructions and Tooling

- Persistent agent instructions are stored in both `AGENTS.md` and `CLAUDE.md`. Keep them in sync when rules change.
- Global Codex skills are sourced from `/Users/trey/.codex/skills`.
- In-repo skill snapshot is tracked in `.claude/skills-available.md`.
- MyLife also includes repo-local skills under `.claude/skills/` for parity, migration, scaffolding, and gate workflows.
- Plugin/MCP availability and re-verification steps are tracked in `.claude/plugins.md`.
- Local execution allow-list settings live in `.claude/settings.local.json`.
- `.claude/settings.json` enables agent teams and runs `pnpm check:parity --quiet` on task completion.

## Code Review Tooling (Critical)

- Do not enable, invoke, recommend, or depend on CodeRabbit for MyLife work.
- Use repository-local review, tests, type checks, security scans, parity gates, and browser evidence instead.

## March 2026 Snapshot Docs (Critical)

- Files under `docs/business-plan/` are March 2026 snapshot materials unless explicitly refreshed.
- Do not treat those docs as the source of truth for current module counts, wiring status, packaging, roadmap sequencing, sync architecture, competitor figures, or investor claims.
- Before using current-looking data, metrics, pricing, market claims, roadmap claims, or implementation status from those docs in any live output, ask the user to verify the data or approve reuse of that snapshot.
- Prefer current source-of-truth files first:
  - `docs/plans/consolidation/README.md`
  - `docs/plans/consolidation/phase-review-report.md`
  - `docs/plans/queue/08-mesh-sync-mission-control.md`
  - `packages/module-registry/src/constants.ts`
  - `apps/mobile/app/_layout.tsx`
  - `apps/web/components/Providers.tsx`

## Automation Hooks

- `.claude/settings.json` is the source of truth for Claude Code hook enforcement in this repo.
- The current hook stack includes:
  - `PreToolUse` Bash policy validation
  - `PostToolUse` targeted TypeScript and debug-code checks after source edits
  - `PreCompact` context snapshot persistence
  - `Stop` response-end snapshot persistence + memory.md breadcrumb (auto-appends session row to Sessions table)
  - `TaskCompleted` parity enforcement
- Hook-generated runtime snapshots are written under `.claude/memory/runtime/` and are gitignored. Do not treat them as product docs.
- The `Stop` memory.md breadcrumb is a safety net, not a replacement for Claude updating memory.md with full session details. The hook writes a minimal auto-logged row; Claude should overwrite it with a proper summary.
- `.husky/pre-commit` runs `pnpm gate:function:changed --staged`. Keep staged source changes compatible with the function gate before committing.

## Key Commands

```bash
pnpm install             # Install all dependencies
pnpm dev                 # Dev mode for all (Turborepo)
pnpm dev:mobile          # Expo mobile only
pnpm dev:web             # Next.js web only
pnpm build               # Build all packages and apps
pnpm test                # Run all tests (Vitest)
pnpm typecheck           # Type check all
pnpm scaffold:function-test --file <path> --function <name> # Scaffold contract + fuzz + perf test template
pnpm gate:function --file <path> # Run lint + typecheck + tests for a changed function package
pnpm gate:function:changed # Run the function gate across all changed source files
pnpm gate:function --standalone <MyAppName> # Run same gate for a contained standalone app root
pnpm gate:function --all-standalone # Run same gate across all contained standalone app roots
pnpm check:module-parity # Verify standalone vs module parity for paired apps
pnpm check:passthrough-parity # Verify passthrough route and registry parity
pnpm check:workouts-parity # Verify workouts standalone vs hub parity
pnpm check:dowork-parity # Verify the DoWork standalone app artifacts
pnpm check:parity # Run the full parity suite used by the task-complete hook
pnpm check:generated-artifacts # Block large generated outputs in tracked docs paths
pnpm clean               # Clean build artifacts
```

## Function Quality Gate Requirement

- For any code change that modifies function logic, run `pnpm gate:function:changed` before finalizing.
- If no function logic changed, state that explicitly when skipping this gate.
- This requirement applies to both hub code and contained standalone apps.

## Performance Artifact Policy

- Large generated performance outputs must not be committed under `docs/performance/`.
- Generated outputs from `pnpm audit:functions` must be written to `artifacts/perf-audit/`.
- Keep `docs/performance/` focused on curated docs and small examples only.
- Before merge, run `pnpm check:generated-artifacts` to block forbidden generated files and oversized tracked files.

## Parity Verification

- `.claude/settings.json` runs `pnpm check:parity --quiet` before a task can be marked complete.
- When parity-sensitive facts change, update docs and verification scripts in the same session.

## Architecture

```
MyLife/
├── apps/
│   ├── bestchef/                  # Standalone Expo app for the recipes module
│   ├── dowork/                    # Standalone Expo app for the workouts module
│   ├── mobile/                    # Single Expo app (iOS + Android)
│   │   ├── app/
│   │   │   ├── _layout.tsx        # Root: DatabaseProvider -> ModuleRegistryProvider -> Stack
│   │   │   └── (hub)/             # Hub dashboard, discover, settings
│   │   └── components/            # Hub shell components
│   └── web/                       # Single Next.js 15 app
│       ├── app/
│       │   ├── layout.tsx         # Persistent sidebar with module icons
│       │   ├── page.tsx           # Hub dashboard
│       │   ├── discover/          # Module browser
│       │   └── settings/          # Account, subscription
│       └── components/            # Sidebar, ModuleCard, Providers
├── modules/                       # Per-module business logic (@mylife/<name>)
│   ├── bestchef books budget car classes closet create cycle dining fast flash/
│   ├── forums friends garden habits health homes journal mail manhattan market/
│   ├── meds mood mynews notes nutrition payments pets presence rsvp shop sleep/
│   └── sports stars subs surf trails travel voice words workouts/
├── packages/
│   ├── ui/                        # @mylife/ui, Obsidian Noir tokens + shared components
│   ├── db/                        # @mylife/db, SQLite adapter, hub schema, migration orchestration
│   ├── module-registry/           # @mylife/module-registry, module metadata + lifecycle
│   ├── auth/                      # @mylife/auth, auth wrapper
│   ├── subscription/              # @mylife/subscription, billing + entitlements
│   ├── migration/                 # @mylife/migration, standalone importers
│   ├── eslint-config/
│   └── typescript-config/
├── supabase/                      # Shared cloud migrations for surf/workouts
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Key Patterns

- **Module system:** Every module exports a `ModuleDefinition` contract. The hub registers, enables/disables, and renders modules dynamically via `@mylife/module-registry`.
- **Single SQLite file:** All local modules share one `.sqlite` with table name prefixes (`bk_` for books, `bg_` for budget, etc.). Hub tables use `hub_` prefix.
- **Theme:** All modules use the Cool Obsidian design system (see Design System section below).
- **Privacy-first:** Zero analytics, zero telemetry, offline-first where possible.

### Registry vs Host App Wiring

- `packages/module-registry/src/types.ts` defines 41 known `ModuleId` values.
- Mobile currently registers full module definitions for 38 modules. The registry-only mobile IDs are `manhattan`, `mynews`, and `subs`.
- Web currently registers full module definitions for 30 modules. The registry-only web IDs are `cycle`, `garden`, `mail`, `mood`, `mynews`, `notes`, `nutrition`, `stars`, `subs`, `trails`, and `voice`.
- Treat `packages/module-registry/src/constants.ts` and each `modules/*/src/definition.ts` file as the source of truth for live IDs, tiers, and prefixes.

### Module Table Prefixes

| Module | Prefix | Module | Prefix |
|--------|--------|--------|--------|
| Hub | `hub_` | Homes | `hm_` |
| Books | `bk_` | Market | `mk_` |
| Budget | `bg_` | Meds | `md_` |
| Car | `cr_` | Nutrition | `nu_` |
| Dining | `dn_` | Presence | `pr_` |
| Fast | `ft_` | Recipes | `rc_` |
| Forums | `fr_` | RSVP | `rv_` |
| Habits | `hb_` | Surf | `sf_` |
| Health | `hl_` | Words | `wd_` |
| Workouts | `wk_` | Source of truth | `modules/*/src/definition.ts` |

### Subscription Tiers

- **Registry free modules:** `classes`, `fast`, `forums`, `friends`, `journal`, `market`, `mood`, `notes`, `voice`
- **Current live free surface:** all nine free modules are wired on mobile. Web has full definitions for `classes`, `fast`, `forums`, `friends`, `journal`, and `market`; `mood`, `notes`, and `voice` remain registry-only on web.
- **MyLife Pro:** Required for premium modules once they are wired into the hub. Verify current packaging and pricing against billing config before publishing product copy.

## Module System

Each module implements `ModuleDefinition` from `@mylife/module-registry`:

```typescript
interface ModuleDefinition {
  id: ModuleId;              // 'books' | 'budget' | 'fast' | ...
  name: string;              // 'MyBooks'
  tagline: string;           // 'Track your reading life'
  icon: string;              // '📚'
  accentColor: string;       // '#C9894D'
  tier: 'free' | 'premium';
  storageType: 'sqlite' | 'supabase' | 'drizzle';
  migrations?: Migration[];
  tablePrefix?: string;      // 'bk_' for books
  navigation: { tabs: ModuleTab[]; screens: ModuleScreen[] };
  requiresAuth: boolean;
  requiresNetwork: boolean;
  version: string;
}
```

**Module lifecycle:** Enable → SQLite migrations run → nav routes activate → dashboard card appears. Disable → routes removed, card hidden, data preserved (NOT deleted).

## Archive Strategy

Standalone app repositories are consolidated into MyLife hub modules. After features merge, the standalone repo moves to `archive/<name>/`. Check git history for consolidation dates and status.

### Consolidation Workflow
1. Review spec for full feature set
2. Gap analysis: map standalone files to hub counterparts
3. Schema migration: add new migration versions for missing tables
4. Business logic migration: copy engines/services into modules/<name>/src/
5. Route wiring: create screens in apps/mobile/ and apps/web/
6. Test migration: port tests, verify with pnpm test
7. Archive: move standalone to archive/<name>/, remove submodule, update docs

## Design System (Obsidian Noir)

The hub uses a warm dark theme with glass morphism.

| Token | Value | Usage |
|-------|-------|-------|
| background | #131318 | App background |
| surface | #131318 | Card/panel fill |
| surfaceElevated | #2A292F | Elevated surfaces |
| text | #E4E1E9 | Primary text |
| textSecondary | #D6C3B5 | Secondary text |
| border | rgba(255,255,255,0.06) | Subtle borders |
| primary | #FFB877 | Hub accent |
| primaryContainer | #C9894D | Hub accent container |
| tertiary | #8BCFF0 | Info/health states |
| outline | #9F8E81 | Outline |
| outlineVariant | #52443A | Subtle outline |
| glass | rgba(255,255,255,0.03) | Glass card fill |
| glassStrong | rgba(255,255,255,0.08) | Strong glass fill |
| glassBorder | rgba(255,255,255,0.10) | Glass card border |
| danger | #FFB4AB | Error text |
| errorContainer | #93000A | Error background |
| success | #30D158 | iOS system green |

Surface tiers (lowest to highest): `#0E0E13`, `#1B1B20`, `#1F1F25`, `#2A292F`, `#35343A`

Glass morphism: use expo-blur BlurView on mobile, backdrop-filter on web.
Token source of truth: packages/ui/src/tokens/


## Session Memory (Critical)

After completing each task, update `memory.md` at the repo root:
1. Update **Project State** and **Known Tech Debt** if anything changed.
2. Add a **one-liner** row to the **Sessions** table (date, short summary, log link). Keep summaries under 120 chars. No component inventories or detailed screen descriptions.
3. Create a session log at `docs/sessions/YYYY-MM-DD-short-description.md` with full details: what was done, why, files changed, verification, remaining items, and any decisions made. This is the verbose record that can be read on demand.
4. Add any reusable insight to **Key Patterns Learned** (avoid duplicating what's already in CLAUDE.md).

**Context budget rule:** `memory.md` must stay under 80 lines total. When the Sessions table exceeds ~15 active rows, archive older rows to `docs/archives/memory-sessions-YYYY-MM.md` and replace with a single archive pointer row.

This is the primary session tracking mechanism. (`timeline.md` archived to `docs/archives/`.)

## Error Log (Critical)

Alongside `memory.md`, maintain `errors_log.md` at the repo root as a running ledger of errors, bugs, and failures encountered during development. This sits next to `memory.md` in the session-memory workflow and is updated at the same time, not batched at end of session.

Row format:

| Date | Error / Symptom | Context (file, command, or module) | Resolution | Status |
|------|-----------------|------------------------------------|------------|--------|

- **Date:** absolute `YYYY-MM-DD`. Never relative.
- **Error / Symptom:** one-line description of what went wrong.
- **Context:** file path, command, module, or surface where it happened.
- **Resolution:** what fixed it, or the workaround. Link to a commit, PR, or session log when useful.
- **Status:** `Resolved`, `Unresolved`, or `Mitigated` (working around it, root cause still open).

### Triggers (when to append a row)

Append a row whenever any of these happen and the cause required investigation or is worth remembering:

1. **Build / compile failures:** TypeScript errors, Metro bundler crashes, Next.js build failures, Turbo build errors.
2. **Test failures** that revealed a real bug (not a flaky run or stale snapshot).
3. **Lint / typecheck gate failures:** `pnpm gate:function`, `pnpm gate:function:changed`, `pnpm typecheck`, `pnpm lint`.
4. **Parity drift:** non-zero exit from `pnpm check:parity`, `check:module-parity`, `check:passthrough-parity`, `check:workouts-parity`.
5. **Pre-commit / husky hook failures**.
6. **EAS Build failures** (iOS / Android) and TestFlight or Play Store rejections.
7. **Runtime crashes during dev:** mobile redbox, web unhandled exception, SQLite migration error.
8. **Regressions:** something that previously worked is now broken.
9. **Silent failures / wrong behavior** caught during QA, `/browse`, `/qa`, `/design-review`, or manual dogfooding.
10. **User-reported bugs:** anytime the user reports an issue in the app or workflow.
11. **DB / migration errors:** failed migration, schema mismatch, data loss.
12. **Dependency issues:** lockfile sync failures, version mismatch, missing peer deps.
13. **Auth / subscription failures:** RevenueCat, Stripe, Supabase auth errors.
14. **Deploy / CI failures:** Vercel, GitHub Actions, EAS submit.
15. **Hook failures:** any `.claude/hooks/*` script failing in ways that affect the workflow.

### What NOT to log

- Typos fixed in the same edit.
- Transient tool errors (network blips, cache misses, MCP server disconnects).
- My own immediate mistakes caught before they affect state.
- Duplicate entries for a known unresolved issue: update the existing row's date instead.

### Rules

- If `errors_log.md` does not exist yet, create it with a short header and the table above on first error.
- Update rather than duplicate. If an existing row's status changes (unresolved becomes resolved, or a recurrence), edit it in place and update the date.
- Mark entries `Unresolved` honestly. Do not close a row until the root cause is actually fixed.
- Do not automatically audit, grep, or scan `errors_log.md` before routine work.
- Audit or search `errors_log.md` only when the user explicitly asks, or when diagnosing or updating a known row after a real logged error.
- Keep entries terse. Long investigations belong in a session log under `docs/sessions/`; link from the Resolution column.
- Archive: when the table grows past ~150 rows, move old Resolved rows and stale never-upgraded auto-stubs to `docs/archives/errors-log-archive-YYYY-MM-DD.md` (first prune: 2026-07-05). Never archive an Unresolved manual row.

### Automated safety net

A `PostToolUse` hook (`.claude/hooks/posttooluse-error-logger.mjs`) scans Bash output for known failure signatures (TypeScript errors, parity failures, EAS build failures, Vitest `FAIL`, migration errors, husky hook failures) and appends a stub row marked `Unresolved - auto-logged` to `errors_log.md`. This is a safety net, not a replacement for Claude maintaining the log. When a stub is written, upgrade it with the real cause and resolution as soon as the issue is diagnosed.

## Report Artifacts (Critical)

- Every markdown deliverable for a report, review, audit, evaluation, or long-form findings doc (`docs/reports/*.md`, review-style `docs/sessions/*.md`) must also get a same-basename human-readable `.html` twin beside it.
- The HTML must be a self-contained single file (inline CSS, no external assets), styled for readability.
- Always open the `.html` in the browser (`open <path>`) immediately after creating it. Creation without opening is incomplete.

## HTML Artifact Lifecycle (Critical)

- Markdown is canonical for plans. Do not keep standalone HTML mission-control files under `docs/plans/` after current Markdown plans or shipped code supersede them.
- Report HTML is a dated visual snapshot, not a live source of truth. Current-looking implementation or launch claims must be verified against code and git history before reuse.
- Keep `docs/README.md`, `docs/reports/README.md`, and any `apps/<app>/docs/README.md` indexes current when HTML artifacts are added, replaced, or removed.
- Runtime, legal, test-fixture, and host UI HTML stays next to the code that consumes it and is not treated as a documentation artifact.
- Remove superseded generated HTML instead of copying it into another archive directory. Git history is the archive unless a historical file has an explicit ongoing use.

## Git Workflow

- **Branch naming:** `feature/`, `fix/`, `refactor/`, `docs/`
- **Commit format:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)
- **Commit cadence:** Commit completed, verified work in logical units proactively and regularly. Do not leave finished, gate-passing work uncommitted, and do not wait to be asked each turn. For feature work, branch off `main` first and commit on the branch (never commit feature work directly to `main`). Run the relevant gates before committing (the `.husky/pre-commit` function gate enforces this on staged changes). There is no "do not commit" rule in this repo; the only blocked git operations are destructive ones (`git reset --hard`, `git checkout -- <file>`, `git clean -f`) and `git push --force`.
- **Push:** push only when the user asks.
- **Merge strategy:** Squash merge to `main`
- **Change tracking:** Update `memory.md` after every development session

## File Ownership Zones (Parallel Agent Work)

| Zone | Owner | Files |
|------|-------|-------|
| Root configs | lead | `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| Module Registry | registry-dev | `packages/module-registry/` |
| Database | db-dev | `packages/db/` |
| UI Package | ui-dev | `packages/ui/` |
| Mobile App | mobile-dev | `apps/mobile/` |
| Web App | web-dev | `apps/web/` |
| Per-module logic | module-dev | `modules/<name>/` |
| Auth + Subscription | auth-dev | `packages/auth/`, `packages/subscription/` |
| Tests | tester | `**/__tests__/` |
| Docs | docs-dev | `CLAUDE.md`, `README.md`, `memory.md` |

## Agent Teams Strategy

Agent team support is enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`. When 2+ tasks target MyLife with overlapping scope, create an Agent Team instead of parallel subagents.

### Available Agent Definitions

**MyLife-specific agents** (`.claude/agents/`):

| Agent | Role | Edits Code? |
|-------|------|-------------|
| `module-dev` | Migrate standalone apps into hub modules, edit module code | Yes |
| `hub-shell-dev` | Edit hub shell (apps/, packages/), dashboard, sidebar, registry | Yes |
| `parity-checker` | Read-only parity validation across standalone apps, modules, and docs | No |

**Workspace-level agents** (inherited from `/Users/trey/Desktop/Apps/.claude/agents/`):

| Agent | Role | Edits Code? |
|-------|------|-------------|
| `plan-executor` | Execute plan phases with testing and verification | Yes |
| `test-writer` | Write tests without modifying source code | Tests only |
| `docs-agent` | Update CLAUDE.md, timeline, README | Docs only |
| `reviewer` | Code review, quality gates (Sonnet) | No |

### Typical Team Compositions

**Module consolidation sprint:**
- Lead: coordinator, task creation
- 2-3x `module-dev`: each owns a different module (e.g., budget, recipes, books)
- 1x `test-writer`: adds test coverage in parallel

**Hub shell feature work:**
- Lead: coordinator
- 1x `hub-shell-dev` (mobile): Expo app changes
- 1x `hub-shell-dev` (web): Next.js app changes
- 1x `module-dev`: module-registry changes if needed

**Cross-module documentation update:**
- Lead: coordinator
- 1x `module-dev` per affected module
- 1x `docs-agent`: updates CLAUDE.md/AGENTS.md pairs
- 1x `parity-checker`: validates parity and sync-sensitive changes before completion

### Team Guidance

- Prefer small teams with clear file ownership.
- Assign file ownership zones from the table above to prevent edit conflicts.
- All teammates automatically load this CLAUDE.md, so critical rules here are enforced team-wide.
- Use `--teammate-mode in-process` for single-terminal sessions or `--teammate-mode tmux` for split panes.

## Context7 Library IDs

Skip `resolve-library-id` and go directly to `query-docs` with these:

| Library | Context7 ID |
|---------|-------------|
| Expo | `/expo/expo` |
| Next.js 15 | `/vercel/next.js` |
| Zod | `/colinhacks/zod` |
| Supabase | `/supabase/supabase-js` |
| tRPC | `/trpc/trpc` |
| Drizzle ORM | `/drizzle-team/drizzle-orm` |
| Mapbox (RN) | `/rnmapbox/maps` |
| RevenueCat | `/revenuecat/purchases-js` |

## Standalone Submodules (Parity Workflow)

- Edit active standalone submodule directories directly when they remain canonical.
- Do not create copies, staging directories, or parallel directory trees for standalone apps.
- After changing an active standalone app with a paired hub module, apply the corresponding hub-side change in the same session.
- Archived standalone placeholders under `archive/` no longer serve as canonical sources. The hub module becomes the maintained implementation.

## Writing Style
- Do not use em dashes in documents or writing.
- Keep all output concise: short responses, minimal commentary, lean code. No filler, no restating what was asked, no unnecessary abstractions or comments in code.

## Report Artifacts

- When producing a markdown report (`*.md`) for audits, reviews, investigations, or long-form findings, also create a same-basename HTML copy beside it for easier human review, for example `report.md` and `report.html`.


### Code Intelligence

Prefer LSP over Grep/Read for code navigation - it's faster, precise, and avoids reading entire files:
- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config).

After writing or editing code, check LSP diagnostics and fix errors before proceeding.

## gstack Quality Gates (Mandatory)

gstack skills are wired into the feature pipeline. These are not optional. Run the appropriate skills based on what you changed.

### After EVERY code change:
- `/function-gate-runner` -- lint + typecheck + tests on changed files
- `/review` -- diff review for SQL safety, race conditions, scope drift. Fix AUTO-FIX items.

### After building UI (screens, components, routes):
- `/browse` -- navigate to the affected URL, click every button, verify all 5 states (loading/empty/error/success/partial)
- After 5 features in a module: `/qa` on the module URL (batch QA)

### For Large/Complex features (Complexity score 0-2):
- `/plan-eng-review` on the feature spec BEFORE building
- `/office-hours` (builder mode) if the feature is strategic or ambiguous

### For business logic engines (budget math, cycle prediction, workout state machine):
- `/domain-engine-benchmarker` -- generate eval suite and verify coverage

### Sprint-level (weekly, handled by lead):
- `/retro` -- weekly engineering retrospective
- `/ship` -- PR, changelog, version bump when sprint is ready
- `/document-release` -- sync docs after ship
- `/parity-check` -- after any module changes
- `/design-review` -- batch visual QA every 10 UI features

### Feature complexity routing:
```
Trivial (Complexity 5): BUILD -> /function-gate-runner -> /review -> merge
Small (4):              BUILD -> /function-gate-runner -> /review -> /browse -> merge
Medium (3):             BUILD -> /function-gate-runner -> /review -> /browse -> merge
Large (2):              /plan-eng-review -> BUILD -> /function-gate-runner -> /review -> /qa -> merge
Complex (1):            /office-hours -> /plan-eng-review -> BUILD -> gates -> /qa -> /design-review -> merge
Massive (0):            /office-hours -> /plan-eng-review -> /plan-design-review -> BUILD (phased) -> all gates -> merge
```

Full pipeline documentation: `docs/designs/feature-execution-pipeline.md`

## MDD Documentation Handbook

Before working on ANY feature, read the relevant doc:

| Feature | Doc |
|---------|-----|
| Hub Shell | docs/uiux-prompts/hub-*.md |
| Module UI | docs/uiux-prompts/my[module].md |
| Feature Spec | docs/plans/features/[module]/[feature].md |

## MDD Rules

- NEVER write code without reading the feature doc first
- If no doc exists for a feature you are modifying: write the doc first
- Audit notes: append after EACH feature, never hold in memory
- Fix prompts: always include audit findings + feature doc + reference implementation
- Ships: doc + code + tests in the same commit, always

## Open Brain Memory System

This workspace is connected to Open Brain, a persistent cross-device AI memory system shared across all devices and projects.

### Mandatory Capture Rule (Critical)

**After every significant deliverable, capture a summary to Open Brain immediately.** Do not batch. Do not wait until end of session. Capture as you go. A "significant deliverable" is any of:
- A commit was made
- A report or document was created
- A design decision was made
- A feature was built, fixed, or reviewed
- A spec or plan was approved
- The user shared a new idea or strategic direction

If a session ends without any Open Brain captures and work was done, the session's context is lost to future conversations. The `Stop` hook writes a breadcrumb to `memory.md` as a safety net, but Open Brain is the cross-device memory. Both must be updated.

**Also update `memory.md`** after completing each task: update Project State, Known Tech Debt, and add a Sessions table row. Do not defer this to end of session.

### Context Rules (Critical)

**EVERY `capture_memory` call from ANY MyLife Claude Code session MUST use context `"personal, mylife"`.** No exceptions. Do not use `"personal"` alone. Do not use `"mylife"` alone. Always both: `"personal, mylife"`.

This applies to: task completions, decisions, observations, bugs found, architecture changes, feature progress, session summaries -- everything.

For `get_briefing` and `search_memories`, search BOTH contexts:
- Call `get_briefing` with context `"personal"` (returns personal + mylife results)
- When searching, use `search_all: true` OR search `"personal"` context (which includes dual-tagged items)

| Project Directory | Capture Context (always use this) | Briefing Context |
|-------------------|----------------------------------|-----------------|
| `MyLife` | `"personal, mylife"` | `"personal"` |
| `Work` | `"work"` | `"work"` |
| `receipts` | `"personal, work"` | `"personal"` |
| `Arena` | `"personal"` | `"personal"` |

If working in an unlisted project, ask the user what context to use and add it to this table.

### Connection Check (Critical)

On every new session anywhere within MyLife, verify that Open Brain MCP tools (`get_briefing`, `capture_memory`, `search_memories`, `add_task`, `list_tasks`, `complete_task`) are available. This check is mandatory before doing anything else.

- **If connected:** Open the chat immediately with **"Brain connection confirmed"** followed by a brief summary of the last known memories and a timeline of what we were working on or talking about (pulled from `get_briefing` and `search_memories`).
- **If not connected:** Warn the user immediately that the Open Brain MCP server is not available and ask them to reconnect before proceeding.

Do not skip this check. Do not wait for the user to ask.

### Session start
At the start of each session, do ALL of the following automatically without being asked:

1. **Confirm MCP connections.** Run `claude mcp list` via Bash and report which servers are connected vs failed. If Open Brain is not connected, warn the user immediately. If key servers (Open Brain, Context7, Perplexity) are missing, list them.
2. **Read `memory.md`** at the repo root (the ground-truth project state, tech debt, and recent sessions).
3. **Call `get_briefing`** with context `"personal"`. Skip if Open Brain not connected.
4. **Report session readiness** to the user:
   ```
   Session Ready:
   - MCP: [N connected, M failed -- list failures]
   - Open Brain: [connected/NOT connected]
   - Briefing: [1-line summary or "skipped"]
   - Project State: [1-line from memory.md]
   ```

**Do NOT read `TODOS.md` on startup.** Only read it when the user asks "what's next", references TODOs, or needs the backlog. This saves ~22 KB of context.

**Do NOT read session log files** (`docs/sessions/*.md`) or archive files on startup. Only read them when the user asks about a specific past session's details or decision context.

`memory.md` tracks engineering state; Open Brain captures cross-device context, ideas, and tasks. Consult both when relevant.

Also search for any active loop tasks from prior sessions and inform the user if any loops need to be re-established.

### When to capture
- Design decisions for modules (architecture, UI choices, data model)
- User preferences and patterns observed across sessions
- Feature ideas and backlog items mentioned in conversation
- Key learnings from consolidation work
- Decisions about module priorities or roadmap
- Business context and history for MyLife and its modules -- capture project-specific context so it accumulates over time as a per-project knowledge base (e.g., "MyLife started as separate standalone apps, consolidation began Phase 0")
- When a report is created -- capture a summary of the report's key findings, conclusions, and where the artifact lives (file path or URL)
- When a spec is finalized and work begins -- capture the spec name, scope, key decisions, and that implementation has started
- New ideas -- when the user floats a new idea, module concept, or "what if we..." thought, capture it immediately even if unstructured. Ideas are cheap to store and expensive to forget.
- Loop task results -- when a `/loop` task fires, capture the result to Open Brain immediately (what was checked, what the outcome was, timestamp context). This ensures loop findings survive session crashes and are available via `get_briefing` in the next session.
- Loop task registration -- when a `/loop` is first created, capture what it monitors, the interval, and why it was set up. On session start, check for any loop tasks in memory that may need to be re-established.

### When to search
- Before starting module work, search for prior context on that module
- When the user asks "what did we decide about..." or references past sessions
- When you need context about a module's design history

### Cross-context search
If the user asks about something that might span work and personal, use `search_memories` with `search_all: true`.

### Tasks
Use `add_task` to track action items that come up. Use `list_tasks` to show pending work. Use `complete_task` when items are resolved.
