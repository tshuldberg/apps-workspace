# Plugin and MCP Inventory

Last verified: 2026-02-28

## MyLife Hub Plugins (22 enabled)

All plugins are from `claude-plugins-official`.

| Plugin | Category | Purpose |
|--------|----------|---------|
| superpowers | Workflow | 15 workflow skills: TDD, debugging, planning, code review, parallel agents |
| github | Integration | GitHub MCP server for issues, PRs, code search |
| code-review | Quality | Multi-agent PR review with confidence scoring |
| commit-commands | Git | `/commit`, `/commit-push-pr`, `/clean_gone` git workflow |
| pr-review-toolkit | Quality | 6 specialized review agents (comments, tests, types, silent failures) |
| frontend-design | UI/UX | Frontend implementation guidance for mobile and web |
| feature-dev | Development | 7-phase guided feature development with architecture focus |
| ralph-loop | Development | Iterative dev loops |
| code-simplifier | Quality | Agent that simplifies code for clarity |
| typescript-lsp | Language | TypeScript Language Server Protocol support |
| figma | Design | Figma MCP server and design-to-code workflows |
| agent-sdk-dev | Development | Agent SDK development tooling |
| claude-code-setup | Setup | Analyze codebases, recommend automations |
| claude-md-management | Docs | Audit and improve CLAUDE.md files |
| playwright | Testing | Browser automation MCP (Playwright) |
| slack | Integration | Slack MCP server for messaging |
| security-guidance | Quality | Security best practices guidance |
| swift-lsp | Language | Swift Language Server Protocol (for Phase 5 macOS app) |
| playground | Tools | Interactive playground environment |
| explanatory-output-style | Style | Enforces educational insight format |
| firecrawl | Tools | Web scraping/crawling |
| coderabbit | Quality | CodeRabbit code review integration |

## Submodule Plugin Coverage

All code-bearing submodules now have `.claude/settings.json` with 14 standard plugins.

| Submodule | Plugins | Notes |
|-----------|---------|-------|
| MyBooks | 14 | Standard TS set |
| MyBudget | 14 | Standard TS set |
| MyCar | 14 | Standard TS set |
| MyFast | 14 | Standard TS set |
| MyHabits | 14 | Standard TS set |
| MyHomes | 14 | Standard TS set |
| MyRecipes | 14 | Standard TS set |
| MyRSVP | 14 | Standard TS set |
| MySurf | 14 | Standard TS set |
| MyVoice | 15 | Standard TS set + swift-lsp (native Obj-C addon) |
| MyWords | 14 | Standard TS set |
| MyWorkouts | 14 | Standard TS set |

**Standard TS set (14 plugins):** superpowers, github, code-review, commit-commands, pr-review-toolkit, frontend-design, feature-dev, ralph-loop, code-simplifier, typescript-lsp, claude-md-management, explanatory-output-style, figma, security-guidance.

**Design-only submodules** (MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMeds, MyMood, MyNotes, MyPets, MyStars, MySubs, MyTrails) do not have plugin settings yet. They will be configured when code development begins.

## MCP Servers

1. **figma** MCP server
   - Verified with `mcp__figma__whoami`
   - Authenticated as `trey.shuldberg@gmail.com`
   - Resources and templates available via `list_mcp_resources` and `list_mcp_resource_templates`

2. **openaiDeveloperDocs** MCP server
   - Verified with `mcp__openaiDeveloperDocs__list_openai_docs` and `mcp__openaiDeveloperDocs__list_api_endpoints`
   - Supports official OpenAI docs search/fetch and OpenAPI endpoint discovery

3. **macos-hub** MCP server (inherited from parent workspace)
   - 32 tools: Reminders (6), Notes (6), Calendar (6), Mail (5), Messages (3), System (3), Watcher (1), Keybindings (2)
   - Available as `mcp__macos-hub__*` tools

4. **Context7** MCP server (deferred/global)
   - Live library documentation fetching
   - Tools: `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`

5. **Playwright** MCP server (via plugin)
   - Browser automation for testing

6. **Slack** MCP server (via plugin)
   - Channel reading, message sending, search

7. **Google Calendar** MCP server (deferred/global)
   - Calendar management tools

## Codex Compatibility Matrix (2026-02-28)

### Claude Plugin to Codex Equivalent

| Claude Plugin | Codex Direct Support | Codex Equivalent | Status |
|---------------|----------------------|------------------|--------|
| superpowers | No | Built-in planning and iterative implementation in Codex | Equivalent |
| github | No | `gh` CLI | Verified (`gh version 2.86.0`) |
| code-review | No | Manual review workflow in Codex (`rg`, tests, diffs) | Equivalent |
| commit-commands | No | `git` CLI | Verified |
| pr-review-toolkit | No | Manual targeted review passes in Codex | Equivalent |
| frontend-design | No | Codex frontend guidance plus Figma MCP when needed | Equivalent |
| feature-dev | No | Manual phased feature implementation in Codex | Equivalent |
| ralph-loop | No | Codex edit and validate loops | Equivalent |
| code-simplifier | No | Manual simplification and refactor in Codex | Equivalent |
| typescript-lsp | No | `tsc`, ESLint, and test commands | Equivalent |
| figma | Yes | `mcp__figma__*` tools | Verified |
| agent-sdk-dev | No | Local tooling plus OpenAI docs MCP | Equivalent |
| claude-code-setup | No | Manual repo analysis in Codex | Equivalent |
| claude-md-management | No | Manual docs audit and updates in Codex | Equivalent |
| playwright | No | `pnpm exec playwright` | Installed and verified (`Version 1.58.2`; browsers installed) |
| slack | No | `slack` CLI | Installed and verified (`Using slack v3.10.0`) |
| security-guidance | No | Manual security review checklist in Codex | Equivalent |
| swift-lsp | No | `swiftc` and `xcodebuild` CLI when needed | Equivalent (tooling-dependent) |
| playground | No | Local scripts and CLIs | Equivalent |
| explanatory-output-style | No | Prompt and writing conventions | Equivalent |
| firecrawl | No | `firecrawl` CLI | Verified (`1.9.0`) |
| coderabbit | No | Manual review plus tests in Codex | Equivalent |

### Claude MCP to Codex Availability

| Claude MCP Entry | Codex Direct Availability | Codex Equivalent | Status |
|------------------|---------------------------|------------------|--------|
| figma | Yes | `mcp__figma__*` | Verified |
| openaiDeveloperDocs | Yes | `mcp__openaiDeveloperDocs__*` | Verified |
| macos-hub | No (not exposed in this Codex session) | None configured | Missing direct equivalent |
| Context7 | No (not exposed in this Codex session) | `web.search_query` plus official docs lookup | Partial equivalent |
| Playwright MCP | No (not exposed in this Codex session) | `pnpm exec playwright` | Equivalent installed (package plus browsers) |
| Slack MCP | No (not exposed in this Codex session) | `slack` CLI | Equivalent installed (`Using slack v3.10.0`) |
| Google Calendar MCP | No (not exposed in this Codex session) | `gcalcli` CLI | Equivalent installed (`gcalcli 4.5.1`) |

## Local Config

- `.claude/settings.local.json` contains local execution permission allow-lists
- No project-local MCP server declarations are stored in this repo

## Re-Verification Commands

```bash
# Count global skills
find /Users/trey/.codex/skills -maxdepth 3 -name 'SKILL.md' | wc -l

# Check repo-local config
cat .claude/settings.local.json

# Skill snapshot
cat .claude/skills-available.md

# Verify submodule plugin coverage
for dir in My*/; do
  if [ -f "$dir/.claude/settings.json" ]; then
    count=$(grep -c "true" "$dir/.claude/settings.json")
    echo "$dir: $count plugins"
  else
    echo "$dir: no settings"
  fi
done

# MCP resources
# use list_mcp_resources / list_mcp_resource_templates tools

# Codex direct MCP checks
# use mcp__figma__whoami
# use mcp__openaiDeveloperDocs__list_openai_docs

# Codex CLI equivalents
gh --version | head -n 1
firecrawl --version
pnpm exec playwright --version
pnpm exec playwright install --dry-run
slack --version | head -n 1
gcalcli --version

# On-demand Playwright (without local install)
npx --yes playwright@latest --version
```
