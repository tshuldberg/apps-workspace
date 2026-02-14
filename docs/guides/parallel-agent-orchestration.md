# Parallel Agent Orchestration Guide

How to run 4-8+ Claude Code agents in parallel across the /Apps workspace. Covers the plan queue system, worktree management, dispatch workflows, and scaling patterns.

**Established:** 2026-02-13
**Applies to:** All projects in `/Users/trey/Desktop/Apps/`

---

## Table of Contents

1. [Core Concept](#core-concept)
2. [Plan Queue System](#plan-queue-system)
3. [Writing Effective Plans](#writing-effective-plans)
4. [Plan Template Reference](#plan-template-reference)
5. [Dispatching Plans](#dispatching-plans)
6. [Worktree Management](#worktree-management)
7. [Agent Teams](#agent-teams)
8. [File Ownership Boundaries](#file-ownership-boundaries)
9. [Conflict Prevention](#conflict-prevention)
10. [Headless Execution](#headless-execution)
11. [Background Research Pattern](#background-research-pattern)
12. [Scaling Guidance](#scaling-guidance)
13. [Daily Workflow](#daily-workflow)
14. [Troubleshooting](#troubleshooting)
15. [External Tools Reference](#external-tools-reference)

---

## Core Concept

At 4+ parallel agents, you stop being a coder and become a **conductor**. Each agent runs 5-20 minutes before needing attention, giving you a natural rotation window:

1. Pick highest-impact task, write a plan, fire an agent
2. Move to the next task, write a plan, fire another agent
3. Cycle back as agents finish or need feedback
4. Merge results, resolve any conflicts, queue the next batch

The system is built on three pillars:
- **Plan files** define work units in enough detail that agents can execute without asking questions
- **Git worktrees** isolate parallel work so agents never edit the same files
- **File ownership boundaries** in each project's CLAUDE.md define safe parallel zones

---

## Plan Queue System

### Directory Structure

```
docs/plans/
  queue/        Plans waiting for execution (drop new plans here)
  active/       Currently being worked on (moved here during execution)
  done/         Completed plans (archive — never delete)
  failed/       Plans that hit blockers (review, fix, move back to queue)
  templates/    plan-template.md (mandatory starting point)
  logs/         JSON execution logs from headless runs
  scripts/      plan-runner.sh, parallel-plan-runner.sh
```

### Plan Lifecycle

```
[You write plan] → queue/ → active/ → done/
                                    ↘ failed/ → [fix] → queue/ (retry)
```

Plans move between directories as they progress. If something is in `active/`, an agent is working on it — do not manually edit those files.

### File Naming Convention

```
[priority]-[project]-[brief-description].md
```

Examples:
```
01-receipts-api-pagination.md
02-fed-memes-imessage-scaffold.md
03-tron-castle-fight-balance-pass.md
05-workspace-documentation-audit.md
```

- Priority 01-05, lower number = higher priority
- Files sort naturally by name, so priority controls execution order
- Use the project's directory name as the project slug
- Keep the description to 3-5 hyphenated words

---

## Writing Effective Plans

### The Cardinal Rule

**Plans must be detailed enough that the executing agent never needs to guess your intent.** The agent working the plan has no access to the conversation where you discussed the idea. The plan is the entire instruction set.

### What Makes a Good Plan

A good plan includes:
- **Specific file paths** — not "update the models" but "modify `app/models/topic.py` lines 45-60"
- **Expected behavior** — not "add pagination" but "return 25 items per page with `?page=N` query parameter, return 404 for pages beyond the last"
- **Edge cases** — what happens with empty results, invalid input, missing data
- **Code patterns to follow** — "use the existing `PaginationMixin` from `util/pagination.py`" or "follow the pattern in `src/adapters/mock.ts`"
- **Concrete acceptance criteria** — not "it works" but "running `npm test` passes, the API returns `X-Total-Count` header, the frontend shows a 'Load More' button when more pages exist"

### What Makes a Bad Plan

- Vague objectives: "improve the auth system" (improve how?)
- Missing scope: no file list (agent doesn't know what it can touch)
- No acceptance criteria (agent doesn't know when it's done)
- Implicit knowledge: "do it the usual way" (agent doesn't share your memory)
- Overlapping scope with another active plan (merge conflict incoming)

### Required Sections

Every plan must have all of these (enforced by the template):

1. **Metadata** — Project, priority, effort estimate, dependencies on other plans, worktree flag
2. **Objective** — 1-3 sentences stating what this accomplishes
3. **Scope** — Explicit list of files/directories affected AND files explicitly off-limits
4. **Phases** — Ordered checklist of steps, each with its own acceptance criteria
5. **Acceptance Criteria** — How to verify the entire plan is complete
6. **Constraints** — Guardrails (files not to touch, conventions to follow, things to avoid)

### The `superpowers:executing-plans` Directive

Every plan must include this header line:

```markdown
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
```

This triggers the plan execution skill which provides structured progress tracking, phase-by-phase verification, and checkpoint reviews.

---

## Plan Template Reference

Location: `docs/plans/templates/plan-template.md`

```markdown
# Plan: [TITLE]

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** [project-name]
- **Priority:** [1-5, lower = higher priority]
- **Effort:** [low/medium/high]
- **Dependencies:** [none, or filenames of plans that must complete first]
- **Worktree:** [yes/no — does this need git worktree isolation?]
- **Created:** YYYY-MM-DD

## Objective
[1-3 sentences on what this accomplishes]

## Scope
- **Files/dirs affected:** [explicit list]
- **Files NOT to touch:** [guardrails]

## Phases

### Phase 1: [Title]
- [ ] Step 1 description
- [ ] Step 2 description
- **Acceptance:** [how to verify this phase is done]

### Phase 2: [Title]
- [ ] Step 1 description
- [ ] Step 2 description
- **Acceptance:** [how to verify this phase is done]

## Acceptance Criteria
- [ ] All tests pass
- [ ] No lint errors
- [ ] Timeline or changelog updated
- [ ] [Project-specific criteria]

## Constraints
- Do NOT modify files outside the declared Scope
- Follow the project's CLAUDE.md conventions
- [Additional guardrails]

## Notes
[Optional context, links, design decisions]
```

Always copy this file. Never write plans from scratch.

---

## Dispatching Plans

### Interactive: `/dispatch` Skill

The recommended way to run plans from within a Claude Code session.

```
/dispatch                       Analyze queue, auto-select strategy, confirm, dispatch
/dispatch --dry-run             Show strategy selection without executing
/dispatch --parallel 3          Max 3 concurrent agents (default: 3)
/dispatch --project receipts    Only dispatch plans for a specific project
/dispatch --strategy team       Force Agent Team for all plans
/dispatch --strategy subagent   Force parallel subagents (skip team coordination)
```

What `/dispatch` does:
1. Reads all `.md` files in `docs/plans/queue/`
2. Displays a priority-sorted table with project, effort, scope, and dependencies
3. Checks for dependency conflicts (plan A needs plan B to finish first)
4. Checks for file scope overlap between plans (hard conflict = same file, soft conflict = parent/child dir)
5. **Selects execution strategy automatically:**
   - Groups plans by project
   - Same-project plans with overlapping scope → Agent Team
   - Same-project plans with no overlap → Parallel Subagents
   - Cross-project plans → Parallel Subagents
6. Shows strategy recommendation with reasoning
7. Asks for confirmation (approve, override strategy, or pick specific plans)
8. Spawns agents (teams or subagents) using custom agent types from `.claude/agents/`
9. Reports results when complete

### Unattended: Queue Runner Scripts

For batch execution without an interactive session.

**Sequential** (one plan at a time):
```bash
./docs/plans/scripts/plan-runner.sh
```

**Parallel** (multiple plans via worktrees):
```bash
./docs/plans/scripts/parallel-plan-runner.sh 4    # up to 4 concurrent agents
```

Both scripts:
- Process plans in priority order (filename sort)
- Move plans from `queue/` → `active/` → `done/` or `failed/`
- Write JSON logs to `docs/plans/logs/`
- Use `claude -p` (headless mode) for execution

---

## Worktree Management

### Why Worktrees

Git worktrees give each agent its own working copy of the repo. This prevents file conflicts when multiple agents work on the same project simultaneously.

### Using `cmux` (Recommended)

`cmux` manages the full worktree lifecycle: create, bootstrap, merge, cleanup.

```bash
# Install (one time)
curl -fsSL https://raw.githubusercontent.com/craigsc/cmux/main/install.sh | sh

# Create a worktree + tmux window + launch Claude
cmux new auth-oauth2

# List all active worktrees/sessions
cmux ls

# Merge completed work back to main + cleanup
cmux merge auth-oauth2

# Remove without merging
cmux rm auth-oauth2
```

### Bootstrap Scripts

Every project has a `.cmux/setup` script that runs automatically when a worktree is created. These scripts:
1. Symlink `.env`, `.env.local`, `.env.development` from the main checkout
2. Install dependencies with the correct package manager

| Project | Package Manager | Install Command |
|---------|----------------|-----------------|
| automation-hub | npm | `npm ci` |
| fed-memes | poetry + make | `poetry install` then `make` |
| macos-hub | npm | `npm ci` |
| MyVoice | npm | `npm ci` |
| Pokemon | bun | `bun install` |
| receipts | poetry + npm | `poetry install` then `cd frontend && npm ci` |
| shiphawk-templates | none | (no dependencies) |
| system-monitor | npm | `npm ci` |
| TheMarlinTraders | npm | `npm ci` |
| ThePillBill | poetry | `poetry install` |
| tron-castle-fight | npm | `npm ci` |
| Parks/easystreet-monorepo | bun | `bun install` |
| Parks/EasyStreet | none | (native iOS/Android) |

If you create worktrees manually (without `cmux`), run the setup script yourself:
```bash
.cmux/setup
```

### Worktree Naming Conventions

- **Directory:** `../Apps-wt-[plan-name]` (sibling to the main /Apps checkout)
- **Branch:** `plan/[plan-name]` (matches plan filename without `.md`)
- After completion, worktrees are removed but branches are preserved for review before merging

### Manual Worktree Commands

```bash
# Create
git worktree add ../Apps-wt-my-feature -b plan/my-feature

# List all worktrees
git worktree list

# Remove (after merging the branch)
git worktree remove ../Apps-wt-my-feature

# Clean up stale worktree references
git worktree prune
```

---

## Agent Teams

Agent Teams are Anthropic's built-in multi-agent coordination system. Already enabled in this workspace via `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Strategy Selection: Teams vs Subagents vs Single

`/dispatch` selects strategy automatically based on plan analysis. The decision matrix:

| Scenario | Strategy | Why |
|----------|----------|-----|
| 2+ plans target the same project with overlapping scope | **Agent Team** | Teammates need to coordinate file access, hand off work |
| 2+ plans target the same project with zero file overlap | **Parallel Subagents** | No coordination needed despite same project |
| Plans target different projects | **Parallel Subagents** | Fully independent, no shared state |
| Single plan or trivial work | **Single Subagent** | No coordination overhead needed |
| Research/exploration only | **Background Subagents** | Read-only, just collecting information |
| Batch/overnight execution | **Queue runner scripts** | No interactive session needed |

You can override with `--strategy team|subagent` or choose interactively.

### How Agent Teams Work

**Architecture:** Team Lead (coordinator) + Specialized Teammates

1. **Lead creates the team** via `TeamCreate` with a descriptive name
2. **Lead creates tasks** from plan phases via `TaskCreate` (aim for 5-6 tasks per teammate)
3. **Lead spawns teammates** via `Task` tool with `team_name` parameter
4. **Lead assigns tasks** via `TaskUpdate` with `owner` matching teammate names
5. **Teammates execute assigned tasks**, messaging the lead on completion or blockers
6. **Lead monitors progress**, resolves conflicts, and manages handoffs

**Key settings:**
- `mode: "delegate"` — Restricts lead to coordination only (no file edits). Use for large teams.
- `mode: "plan"` — Requires teammates to plan before implementing. Lead reviews/approves.
- Teammates go idle after each turn — this is normal. Send a message to wake them.

**Display modes:**
- In-process (default): Switch between agents with `Shift+Up/Down`
- Split panes: Set `"teammateMode": "tmux"` in `.claude/settings.json`

### Team Composition Templates

| Scenario | Lead Mode | Teammates |
|----------|-----------|-----------|
| Feature development (2-3 plans) | delegate | 2-3 plan-executors + 1 reviewer |
| Test expansion (2+ plans) | default | 2-3 test-writers |
| Mixed (implementation + docs) | default | plan-executors + docs-agent |
| Large refactor (3+ plans) | delegate | plan-executors + test-writer + reviewer |
| Documentation sprint | default | 2-3 docs-agents |

### Custom Agent Definitions

Reusable agent roles are defined in `.claude/agents/`:

| Agent | File | Role | Can Edit Files? |
|-------|------|------|-----------------|
| `plan-executor` | `.claude/agents/plan-executor.md` | Execute plan phases with testing | Yes |
| `test-writer` | `.claude/agents/test-writer.md` | Write tests, never modify source | Tests only |
| `docs-agent` | `.claude/agents/docs-agent.md` | Update docs, diagrams, CLAUDE.md | Docs only |
| `reviewer` | `.claude/agents/reviewer.md` | Read-only code review | No (uses Sonnet for cost efficiency) |

**Using custom agents:**
```
Use the Task tool with:
  subagent_type: "plan-executor"   ← matches the agent filename
  team_name: "my-team"             ← joins the team
  name: "backend-1"                ← human-readable teammate name
  mode: "plan"                     ← optional: require plan approval
```

**Creating new agents:** Add a `.md` file to `.claude/agents/` with YAML frontmatter:
```yaml
---
name: my-agent
description: What this agent does
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet  # optional: sonnet/opus/haiku
---

# System prompt for the agent
Instructions go here...
```

### Example: Dispatching 4 Plans

Given these plans in the queue:
```
01-receipts-api-pagination.md    (project: receipts, scope: app/views/, frontend/...)
02-receipts-user-profiles.md     (project: receipts, scope: accounts/, frontend/...)
03-fed-memes-imessage-scaffold.md (project: fed-memes, scope: FedMemes/)
04-tron-castle-balance-pass.md   (project: tron-castle-fight, scope: game.js)
```

`/dispatch` would select:
```
Strategy: MIXED (1 Agent Team + 2 Parallel Subagents)

  Team "receipts-dispatch-2026-02-13":
    Plans: 01 + 02 (same project, overlapping frontend/ scope)
    Composition: Lead (coordinator) + backend-1 + frontend-1 + reviewer

  Subagent 1: 03-fed-memes-imessage-scaffold (independent project)
  Subagent 2: 04-tron-castle-balance-pass (independent project)

Total agents: 6 (4 team + 2 independent)
```

### Task Sizing for Teams

- **5-6 tasks per teammate** is the sweet spot (per official docs)
- Too few tasks: overhead of team creation isn't worth it
- Too many: risk of context exhaustion and drift
- Combine small plan phases into single tasks when they touch the same files
- Split large phases into multiple tasks when they can be parallelized

---

## File Ownership Boundaries

Every project's CLAUDE.md has a "Parallel Agent Work" section defining file ownership zones. These tell agents which directories belong to which role so they don't step on each other.

### How It Works

When you write a plan, its **Scope** section should align with one or more ownership zones from the target project. If a plan crosses boundaries, either:
1. Split it into separate plans (one per zone)
2. Explicitly acknowledge the overlap in the Constraints section

### Example: receipts

```
Backend models/views agent:  app/, receipt/, accounts/, comments/, notifications/
Backend infra agent:         util/, celery config, Django settings
Frontend components agent:   frontend/src/components/
Frontend state/utils agent:  frontend/src/store/, frontend/src/util/, frontend/src/hooks/
Tests agent (backend):       app/tests/, receipt/tests/, accounts/tests/
Tests agent (frontend):      frontend/src/**/*.test.*
Docs agent:                  timeline.md, docs/, .claude/docs/
```

### Example: tron-castle-fight (Special Case)

```
Game engine agent:    game.js (single-file engine — divide by section, never have 2 agents edit simultaneously)
UI/theme agent:       index.html, styles.css
Multiplayer agent:    server/server.js, online-game.js, online.html
Docs agent:           PROJECT_LOG.md, CLAUDE.md
```

Special warning: `game.js` is monolithic. Split work by section (config constants vs AI behavior vs rendering), never by file.

### Maintaining Boundaries

- If you refactor a project's directory structure, update the ownership boundaries in its CLAUDE.md
- The boundaries are guidance, not hard enforcement — agents read and respect them but won't crash if violated
- Customer/feature directories are natural parallelism boundaries (e.g., shiphawk-templates uses one customer per agent)

---

## Conflict Prevention

### Before Dispatching

1. **Check active plans:** Read `docs/plans/active/*.md` to see what agents are already working on
2. **Compare scopes:** If your new plan's Scope overlaps with an active plan's Scope, wait or merge
3. **Use `/dispatch --dry-run`:** Shows conflicts before any agents start

### During Execution

- Agents check `docs/plans/active/` before starting (part of the execution rules)
- If scope overlaps, agents are instructed to coordinate or wait
- Agents run the project's test suite after each phase to catch regressions

### After Completion

- Review plan branches before merging: `git branch --list plan/*`
- Check for orphaned worktrees: `git worktree list`
- Failed plans stay in `failed/` with logs in `logs/` — review before retrying

---

## Headless Execution

Claude Code can run without an interactive terminal using `claude -p`.

### Basic Usage

```bash
claude -p "Your prompt here"
```

### With Controls

```bash
claude -p "Execute this plan..." \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
  --output-format json
```

- `--allowedTools` restricts what the headless agent can do
- `--output-format json` captures structured output for logging
- The queue runner scripts use this exact pattern

### When to Use

- Automated plan execution via queue runners
- CI/CD pipelines (see `anthropics/claude-code-action` for GitHub Actions)
- Overnight batch runs
- Any scenario where you don't need interactive control

---

## Background Research Pattern

For research-heavy tasks that don't require code changes, spawn background agents:

```
Use the Task tool with:
  subagent_type: "general-purpose"
  run_in_background: true
  prompt: "Research [topic] and return findings..."
```

Multiple research agents can run concurrently on different questions. Results are collected after completion via `TaskOutput` or by reading the output file.

This is useful for:
- Researching libraries, APIs, or documentation before writing plans
- Analyzing multiple codebases in parallel
- Gathering information from different sources simultaneously

---

## Scaling Guidance

### Recommended Agent Counts

| Agents | Best For | Coordination Overhead | Token Multiplier |
|--------|----------|-----------------------|------------------|
| 2-3 | Active development, quick iteration | Low — track mentally | ~3x single session |
| 4-6 | Feature development across modules | Medium — use tmux + naming | ~7x single session |
| 6-8 | Large refactors, multi-project work | High — use cmux or Agent Teams | ~12x single session |
| 8+ | Massive parallel efforts | Very high — requires plan files + conflict detection | ~15x+ single session |

### Token Warning

8 agents is NOT 8x the tokens of one agent. Each agent independently explores context, makes mistakes, and backtracks. Budget 12-15x a single session's token usage when running 8 agents.

### Task Sizing

Each plan should represent 5-30 minutes of agent work:
- Too small (<5 min): overhead of plan creation isn't worth it
- Too large (>30 min): risk of agent getting lost or hitting context limits
- Split large features into multiple plans with dependencies

### The Independence Test

Before running plans in parallel, every task pair must pass:

| Check | Required? |
|-------|-----------|
| Touch different files? | Yes |
| Can complete without waiting on the other? | Yes |
| Belong to different modules/layers? | Strongly preferred |
| Each 5-30 min of agent work? | Ideal |

---

## Daily Workflow

### Morning Setup (5 minutes)

1. Check `docs/plans/failed/` — fix and move back to `queue/` if needed
2. Write 2-3 new plan files from your backlog into `docs/plans/queue/`
3. Run `/dispatch --dry-run` to preview the queue

### Working Session

4. `/dispatch` to fire agents on independent plans
5. Open your own terminals for interactive work on separate projects
6. Rotate between agents as they finish or need feedback
7. Check `docs/plans/done/` and `docs/plans/failed/` as agents complete

### Same-Project Parallel Work

8. Use Agent Teams for coordinated within-project work
9. Or use `cmux new [name]` for worktree-based isolation

### End of Session

10. Check for orphaned worktrees: `git worktree list`
11. Review plan branches: `git branch --list plan/*` — merge or delete
12. Move any stalled `active/` plans back to `queue/` or `failed/`

---

## Troubleshooting

### Plan stuck in `active/`

An agent crashed or was interrupted. Check `docs/plans/logs/` for the execution log. Move the plan back to `queue/` (to retry) or `failed/` (to investigate).

### Merge conflicts after parallel work

Two agents edited the same file. This means the file ownership boundaries weren't respected, or two plans had overlapping Scope sections. Fix the conflict manually, then update the project's CLAUDE.md boundaries if needed.

### Worktree won't delete

```bash
git worktree remove ../Apps-wt-[name] --force
git worktree prune
```

### Agent ran out of context

The plan was too large. Split it into smaller plans with dependencies:
```
Dependencies: [01-plan-phase-1.md]
```

### `claude -p` not found

Claude Code CLI must be installed globally: `npm install -g @anthropic-ai/claude-code`

### `.cmux/setup` fails in worktree

The setup script can't find dependencies. Check that the `REPO_ROOT` resolution is correct:
```bash
git rev-parse --git-common-dir | xargs dirname
```
This should point to the main checkout, not the worktree.

---

## External Tools Reference

Tools discovered during research that complement this workflow:

| Tool | Purpose | URL |
|------|---------|-----|
| **cmux** | Worktree + tmux lifecycle (recommended) | github.com/craigsc/cmux |
| **continuous-claude** | Unattended loop runner with shared notes | github.com/AnandChowdhary/continuous-claude |
| **parallel-cc** | Cloud sandbox dispatch | github.com/frankbria/parallel-cc |
| **ccpm** | PRD → Epic → GitHub Issues pipeline | github.com/automazeio/ccpm |
| **planning-with-files** | 3-file persistent planning plugin | github.com/OthmanAdi/planning-with-files |
| **Backlog.md** | MCP-enabled task queue | github.com/MrLesk/Backlog.md |
| **Clash** | Merge conflict detection across worktrees | github.com/clash-sh/clash |
| **dmux** | Interactive agent multiplexer TUI | github.com/formkit/dmux |
| **workmux** | Opinionated Rust worktree tool | github.com/raine/workmux |
| **Claude Agent SDK** | Programmatic plan queue orchestration | github.com/anthropics/claude-agent-sdk-typescript |

---

## Related Files

- **Root config:** `/Users/trey/Desktop/Apps/CLAUDE.md` (Plan Queue Protocol + Operational Patterns sections)
- **Root agents:** `/Users/trey/Desktop/Apps/AGENTS.md` (synced plan queue rules)
- **Settings:** `/Users/trey/Desktop/Apps/.claude/settings.json` (Agent Teams enabled)
- **Plan template:** `docs/plans/templates/plan-template.md`
- **Sequential runner:** `docs/plans/scripts/plan-runner.sh`
- **Parallel runner:** `docs/plans/scripts/parallel-plan-runner.sh`
- **Dispatch skill:** `.claude/skills/dispatch/SKILL.md`
- **Custom agents:** `.claude/agents/plan-executor.md`, `.claude/agents/test-writer.md`, `.claude/agents/docs-agent.md`, `.claude/agents/reviewer.md`
- **Agent Teams research:** `docs/reports/REPORT-docs-agent-teams-best-practices-2026-02-13.md`
- **Scaling research:** `docs/reports/scaling-claude-code-8-agents-research.md`
- **Skills registry:** `.claude/skills/SKILLS_REGISTRY.md`
