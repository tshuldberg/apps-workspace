# Plan: MyLife Context Optimization

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyLife (hub)
priority: 03
effort: S
dependencies: []
worktree: false
parallel_phases: true
created: 2026-03-08
audit_ref: docs/reports/REPORT-production-readiness-audit-2026-03-08.md
findings: C4, C5, H17
```

## Objective

Reduce per-session context overhead by removing duplicate MCP tool registrations, pruning the bloated `settings.local.json` allow-list, and disabling redundant plugins. The audit found 127 MCP tools (threshold: 80), a 40KB settings.local.json with 242 historical rules, and 6 redundant plugins. These quick wins reclaim significant context window space every session without touching any source code.

## Scope

### Files Affected

- `.claude/settings.json` -- remove duplicate plugin entries, disable redundant plugins (C4, H17)
- `.claude/settings.local.json` -- prune historical allow-list rules to under 80 entries (C5)

### Files NOT Affected

- All source code (`modules/`, `packages/`, `apps/`)
- Agent definitions (`.claude/agents/`)
- Documentation (`docs/`, `CLAUDE.md`, `AGENTS.md`)
- CI/CD config (`.github/`)

## Phases

### Phase 1: Remove Duplicate MCP Registrations (C4)

The audit found Figma registered 3 times (36 redundant tool slots) and Context7 registered twice.

- [ ] Read `.claude/settings.json` `enabledPlugins` section
- [ ] Identify Figma registrations:
  - `figma@claude-plugins-official` -- official plugin (KEEP)
  - Check if `figma-remote` MCP server is also registered (this is in user-level MCP config, not project settings)
  - Check if `claude.ai Figma` remote MCP is also registered (user-level)
- [ ] Identify Context7 registrations:
  - `context7` MCP server
  - `claude.ai Context7` remote MCP
  - Determine which one to keep (prefer the one with better tool coverage)
- [ ] Document which registrations are user-level vs project-level -- project settings can only control project-level entries
- [ ] For project-level duplicates: remove from `.claude/settings.json`
- [ ] For user-level duplicates: document the recommendation for the user to manually remove them from their user-level config (cannot edit user config in project scope)
- [ ] Count remaining tools after changes

**Acceptance:** No duplicate Figma or Context7 registrations in project-level settings. User-level duplicates documented with removal instructions.

### Phase 2: Prune settings.local.json (C5)

The 40KB file with 242 historical allow-list rules is loaded every session.

- [ ] Read `.claude/settings.local.json` fully
- [ ] Categorize all rules:
  - **Keep:** Reusable patterns that apply across sessions (e.g., `pnpm test`, `pnpm build`, `git status`)
  - **Remove:** Single-use git commit message strings (e.g., specific commit hashes, one-time commands)
  - **Remove:** Redundant rules that duplicate project-level settings
  - **Remove:** Rules for projects/paths that no longer exist
  - **Remove:** Overly specific `node` command invocations that were one-time scripts
- [ ] Write the pruned file, targeting under 80 rules total
- [ ] Validate the file is valid JSON
- [ ] Verify no commonly-used development commands lost their allow-list entries

**Acceptance:** `settings.local.json` has fewer than 80 rules. File size under 15KB. All active development workflows still work without extra permission prompts.

### Phase 3: Disable Redundant Plugins (H17)

The audit identified 6 plugins that are redundant with MCP servers or unused.

- [ ] Read `.claude/settings.json` `enabledPlugins` section
- [ ] Evaluate each candidate for removal:
  - `github@claude-plugins-official` -- gh CLI already available via Bash; MCP not needed (DISABLE)
  - `playground@claude-plugins-official` -- rarely used for MyLife development (DISABLE)
  - `swift-lsp@claude-plugins-official` -- macOS SwiftUI is a future phase, not active (DISABLE)
  - `figma@claude-plugins-official` -- if keeping figma-remote MCP, this is redundant (EVALUATE)
  - `slack@claude-plugins-official` -- Slack MCP server already registered (EVALUATE)
  - `playwright@claude-plugins-official` -- Playwright MCP server already registered (EVALUATE)
- [ ] For plugins where both a plugin and MCP server exist, keep the MCP server (richer tool set) and disable the plugin
- [ ] Remove disabled plugins from the `enabledPlugins` object (set to `false` or remove the key entirely)
- [ ] Verify remaining plugin count is reasonable (target: 15 or fewer)

**Acceptance:** At least 4 redundant plugins disabled. `enabledPlugins` count reduced from 21 to 17 or fewer. No development workflows broken.

## Acceptance Criteria

1. No duplicate Figma or Context7 registrations at the project level
2. User-level duplicate MCP recommendations documented (if applicable)
3. `settings.local.json` pruned to under 80 rules and under 15KB
4. At least 4 redundant plugins disabled in `settings.json`
5. All files remain valid JSON
6. `pnpm dev:web` and `pnpm test` still work after changes (sanity check)
7. Common development commands do not trigger new permission prompts

## Constraints

- This plan is config-only -- do not modify any source code, tests, or documentation
- Do not remove plugins that are actively used in daily development (e.g., `typescript-lsp`, `commit-commands`, `code-review`, `explanatory-output-style`)
- User-level MCP configs cannot be edited from project scope -- document recommendations only
- When pruning `settings.local.json`, err on the side of keeping rules if unsure whether they are still needed
- Keep the file valid JSON at every step -- invalid JSON breaks all Claude Code sessions
- Do not remove `enabledPlugins` entries for plugins used by skills listed in the CLAUDE.md skills section
