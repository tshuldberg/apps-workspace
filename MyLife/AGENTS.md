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

## App Isolation + Hub Inclusion (Critical)

- Any app added to the `/Users/trey/Desktop/Apps` workspace must be either:
  - a fully isolated standalone app directory (for example `MyWords/`), or
  - a module integrated into the MyLife hub (`modules/<name>/` with routes wired in `apps/mobile` and/or `apps/web`).
- If an app exists in both forms, keep the standalone app fully isolated in its own directory and keep hub integration inside MyLife module/app boundaries.
- Do not scatter standalone app files directly in the MyLife root.

## Standalone/Module Parity (Critical)

- Standalone app repositories are the canonical product sources of truth.
- If an app exists as both a standalone repo and a MyLife module, both must remain identical products (features, behavior, data model intent, and UX intent).
- Do not ship module-only or standalone-only capabilities.
- Any parity-impacting change must be applied in both codebases and documented in both instruction pairs (`AGENTS.md` + `CLAUDE.md`) in the same session.
- Optional networked capabilities (for example bank sync) are allowed, but option availability and behavior must match between standalone and module versions.
- Hub implementations must be parity adapters, not independent rewrites.
- For any standalone + module pair, route/screen structure, user-visible labels, controls, and settings must match exactly; only hub shell chrome (sidebar/top-level hub navigation) may differ.
- Hub shell theming may differ, but module screen theming must match the standalone app for that module.
- Avoid duplicate UI logic across standalone and hub. Prefer shared components/packages or thin adapter layers that keep one canonical source.
- Web passthrough parity is enforced by direct route reuse for passthrough-enabled modules (`books`, `habits`, `words`, `workouts`): hub files under `apps/web/app/<module>/**` must stay thin wrappers that import standalone pages from the corresponding `@my<module>-web/app/**` alias.
- Any parity validation failure is a release blocker. Run `pnpm check:parity` before merging parity-impacting work.
- Use `pnpm check:module-parity` for cross-module parity inventory checks, `pnpm check:passthrough-parity` for standalone↔hub parity matrix plus strict passthrough wrapper enforcement, and `pnpm check:workouts-parity` for strict MyWorkouts UI/data parity checks.
- Modules with standalone repos that only contain design docs are treated as parity-deferred until standalone runtime code exists.

## Standalone Submodules (Parity Workflow)

Standalone submodule directories (`MyBooks/`, `MyBudget/`, etc.) inside the MyLife repo are the canonical product sources. For parity work:
- Edit standalone submodules directly -- they are the source of truth.
- Do not create copies, staging directories, or parallel directory trees for standalone apps.
- Do not create directories at the `/Apps/` root or adjacent to `MyLife/` for parity scaffolding.
- After editing a standalone submodule, apply the corresponding hub-side change in `modules/<name>/` and/or `apps/` within the same session.
- Verify with `pnpm check:parity` before merging parity-impacting work.

## Agent Teams

- Agent team support is enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `.claude/settings.json`.
- MyLife-specific agent definitions live in `.claude/agents/` (module-dev, hub-shell-dev, parity-checker).
- Workspace-level agent definitions (plan-executor, test-writer, docs-agent, reviewer) are also available from `/Users/trey/Desktop/Apps/.claude/agents/`.
- When spawning teams, assign file ownership zones from CLAUDE.md to prevent edit conflicts.
- Parity-impacting work requires a `parity-checker` teammate to validate before marking tasks complete.
- All teammates automatically load CLAUDE.md and AGENTS.md, so critical rules here are enforced team-wide.
- Start with 3-5 teammates. Size tasks at 5-6 per teammate.
- See CLAUDE.md for typical team compositions and full agent table.

## Skills Availability

- Skills are sourced from the global Codex skills directory: `/Users/trey/.codex/skills`.
- Verified on 2026-02-24: 67 skills with `SKILL.md` are available (including `.system/*` skills).
- Verify current availability with:
  - `find /Users/trey/.codex/skills -maxdepth 3 -name 'SKILL.md' | wc -l`
  - `find /Users/trey/.codex/skills -maxdepth 3 -name 'SKILL.md'`
- Do not assume `.claude/skills` exists in this repo unless explicitly added later.

## Plugins / MCP Availability

- Confirmed working in this workspace on 2026-02-24:
  - `figma` MCP server (authenticated user: `trey.shuldberg@gmail.com`)
  - `openaiDeveloperDocs` MCP server tools
- Canonical inventory lives in `.claude/plugins.md`.


## Writing Style
- Do not use em dashes in documents or writing.

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


### Code Intelligence

Prefer LSP over Grep/Read for code navigation - it's faster, precise, and avoids reading entire files:
- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config).

After writing or editing code, check LSP diagnostics and fix errors before proceeding.