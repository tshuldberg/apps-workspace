# AGENTS.md

Project-specific agent instructions for `/Users/trey/Desktop/Apps/MyLife`.

## Instruction Pair (Critical)

- Keep this file and `CLAUDE.md` synchronized for persistent project rules.
- When a long-lived workflow or constraint changes, update both files in the same session.

## Startup Checklist

- Read `AGENTS.md` and `CLAUDE.md` before making substantial edits.
- Review `.claude/settings.local.json` for local execution constraints.
- Review `.claude/skills-available.md` for the current in-repo skill snapshot.
- Review `.claude/plugins.md` for currently verified MCP/plugin availability.

## TypeScript Requirement (Critical)

- Default to TypeScript for application and shared package code whenever feasible.
- For new product/runtime code, prefer .ts/.tsx over .js/.jsx.
- Use JavaScript only when a toolchain file requires it (for example Babel or Metro config).

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
- Use `pnpm check:module-parity`, `pnpm check:passthrough-parity`, `pnpm check:workouts-parity`, `pnpm check:dowork-parity`, and `pnpm check:parity` for parity-impacting work.

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

## Standalone Submodules (Parity Workflow)

- Edit active standalone submodule directories directly when they remain canonical.
- Do not create copies, staging directories, or parallel directory trees for standalone apps.
- After changing an active standalone app with a paired hub module, apply the corresponding hub-side change in the same session.
- Archived standalone placeholders under `archive/` no longer serve as canonical sources. The hub module becomes the maintained implementation.

## Agent Teams

- Agent team support is enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`.
- MyLife-specific agent definitions live in `.claude/agents/` (module-dev, hub-shell-dev, parity-checker).
- Workspace-level agent definitions (plan-executor, test-writer, docs-agent, reviewer) are also available from `/Users/trey/Desktop/Apps/.claude/agents/`.
- When spawning teams, assign file ownership zones from CLAUDE.md to prevent edit conflicts.
- All teammates automatically load CLAUDE.md and AGENTS.md, so critical rules here are enforced team-wide.
- Prefer small teams with clear file ownership.
- See CLAUDE.md for typical team compositions and full agent table.

## Skills Availability

- Skills are sourced from the global Codex skills directory: `/Users/trey/.codex/skills`.
- MyLife also has repo-local skills under `.claude/skills/` for parity, migration, scaffolding, and gate workflows.
- Check `.claude/skills-available.md` or inspect the skills directories directly if availability needs re-verification.

## Plugins / MCP Availability

- See `.claude/plugins.md` for the current verified inventory and re-verification steps.
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
| tertiary | #8BCFF0 | Info and health states |
| outline | #9F8E81 | Outline |
| outlineVariant | #52443A | Subtle outline |
| glass | rgba(255,255,255,0.03) | Glass card fill |
| glassStrong | rgba(255,255,255,0.08) | Strong glass fill |
| glassBorder | rgba(255,255,255,0.10) | Glass card border |
| danger | #FFB4AB | Error text |
| errorContainer | #93000A | Error background |
| success | #30D158 | iOS system green |

Surface tiers (lowest to highest): `#0E0E13`, `#1B1B20`, `#1F1F25`, `#2A292F`, `#35343A`.

Glass morphism: use expo-blur BlurView on mobile, backdrop-filter on web.
Token source of truth: packages/ui/src/tokens/


## Writing Style
- Do not use em dashes in documents or writing.

## Report Artifacts

- When producing a markdown report (`*.md`) for audits, reviews, investigations, or long-form findings, also create a same-basename HTML copy beside it for easier human review, for example `report.md` and `report.html`.

## Function Quality Gate

- For new or changed functions, scaffold and run the function quality gate before finalizing work:
  - `pnpm scaffold:function-test --file <path> --function <name>`
  - `pnpm gate:function --file <path>`
- Agent enforcement requirement:
  - If a change includes function logic in source files, run `pnpm gate:function:changed` before completion.
  - If no function logic changed, state that explicitly when skipping the gate.
- The same gate must be applicable to contained standalone apps:
  - `pnpm gate:function --standalone <MyAppName>`
  - `pnpm gate:function --all-standalone`

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

## Git Workflow (Critical)

- **Branch naming:** `feature/`, `fix/`, `refactor/`, `docs/`. **Commit format:** Conventional Commits.
- **Commit cadence:** Commit completed, verified work in logical units proactively and regularly. Do not leave finished, gate-passing work uncommitted, and do not wait to be asked each turn. For feature work, branch off `main` first and commit on the branch (never commit feature work directly to `main`). Run the relevant gates before committing (the `.husky/pre-commit` function gate enforces this on staged changes).
- **Push:** push only when the user asks.
- There is no "do not commit" rule in this repo. The only blocked git operations are destructive ones (`git reset --hard`, `git checkout -- <file>`, `git clean -f`, via `.claude/hooks/pretooluse-bash-policy.mjs`) and `git push --force` (via `settings.json` deny). Commit, add, branch, and normal push are always allowed.

## Performance Artifact Policy

- Large generated performance outputs must not be committed under `docs/performance/`.
- Generated outputs from `pnpm audit:functions` must be written to `artifacts/perf-audit/`.
- Keep `docs/performance/` focused on curated docs and small examples only.
- Before merge, run `pnpm check:generated-artifacts` to block forbidden generated files and oversized tracked files.

## Parity Verification

- `.claude/settings.json` runs `pnpm check:parity --quiet` before a task can be marked complete.
- When parity-sensitive facts change, update docs and verification scripts in the same session.

## Error Log (Critical)

Alongside `memory.md`, maintain `errors_log.md` at the repo root as a running ledger of errors, bugs, and failures. Update it in the same flow as `memory.md`, not batched at end of session.

Row format:

| Date | Error / Symptom | Context (file, command, or module) | Resolution | Status |
|------|-----------------|------------------------------------|------------|--------|

- **Date:** absolute `YYYY-MM-DD`. Never relative.
- **Error / Symptom:** one-line description.
- **Context:** file path, command, module, or surface.
- **Resolution:** fix or workaround. Link to commit, PR, or session log when useful.
- **Status:** `Resolved`, `Unresolved`, or `Mitigated`.

### Triggers (when to append a row)

1. Build / compile failures (TypeScript, Metro, Next.js, Turbo).
2. Test failures that revealed a real bug.
3. Lint / typecheck gate failures (`pnpm gate:function`, `gate:function:changed`, `typecheck`, `lint`).
4. Parity drift (any `pnpm check:parity*` non-zero exit).
5. Pre-commit / husky hook failures.
6. EAS Build failures and store rejections.
7. Runtime crashes in dev (redbox, web exception, SQLite migration error).
8. Regressions.
9. Silent failures / wrong behavior from QA, `/browse`, `/qa`, `/design-review`, dogfooding.
10. User-reported bugs.
11. DB / migration errors.
12. Dependency issues (lockfile sync, version mismatch, missing peers).
13. Auth / subscription failures (RevenueCat, Stripe, Supabase).
14. Deploy / CI failures (Vercel, GitHub Actions, EAS submit).
15. Hook failures affecting workflow.

### What NOT to log

- Typos fixed in the same edit.
- Transient tool errors (network blips, cache misses, MCP disconnects).
- Immediate self-corrections.
- Duplicate rows for a known unresolved issue: update the existing row instead.

### Rules

- Create the file with a short header and the table on first error if it does not exist.
- Update existing rows in place; do not duplicate.
- Mark `Unresolved` honestly until the root cause is fixed.
- Do not automatically audit, grep, or scan `errors_log.md` before routine work.
- Audit or search `errors_log.md` only when the user explicitly asks, or when diagnosing or updating a known row after a real logged error.
- Keep entries terse; long investigations go in `docs/sessions/` and are linked from the Resolution column.
- Archive: when the table grows past ~150 rows, move old Resolved rows and stale never-upgraded auto-stubs to `docs/archives/errors-log-archive-YYYY-MM-DD.md` (first prune: 2026-07-05). Never archive an Unresolved manual row.

### Automated safety net

A `PostToolUse` hook (`.claude/hooks/posttooluse-error-logger.mjs`) scans Bash output for known failure signatures and appends stub rows marked `Unresolved - auto-logged`. Upgrade stubs with real cause and resolution as soon as diagnosed.

### Code Intelligence

Prefer LSP over Grep/Read for code navigation - it's faster, precise, and avoids reading entire files:
- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config).

After writing or editing code, check LSP diagnostics and fix errors before proceeding.
