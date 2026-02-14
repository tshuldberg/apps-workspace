---
name: dispatch
description: Read plans from the queue and intelligently dispatch them — choosing between Agent Teams (coordinated same-project work), parallel subagents (independent cross-project work), or single agents based on plan analysis. Use when asked to "dispatch", "run the queue", "process plans", or "start parallel work".
argument-hint: [--parallel N] [--dry-run] [--project filter] [--strategy team|subagent|auto]
allowed-tools: Read, Edit, Bash(ls:*), Bash(git:*), Bash(chmod:*), Bash(mkdir:*), Bash(mv:*), Bash(cp:*), Bash(wc:*), Glob, Grep, Task, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, TeamCreate, TeamDelete, SendMessage
---

# /dispatch — Intelligent Plan Queue Dispatcher

You are dispatching plans from the workspace plan queue. You analyze the queue to select the best execution strategy, then dispatch accordingly.

## Input

`$ARGUMENTS` — Optional flags:
- `--parallel N` — Max concurrent agents (default: 3)
- `--dry-run` — Show strategy selection and what would be dispatched, no execution
- `--project <name>` — Only dispatch plans for a specific project
- `--strategy <team|subagent|auto>` — Force a specific strategy (default: auto)
- No arguments — interactive mode: analyze queue, recommend strategy, let user confirm

## Step 1: Read the Queue

1. List all `.md` files in `/Users/trey/Desktop/Apps/docs/plans/queue/` sorted by name
2. For each plan, read the **Metadata** section to extract: project, priority, effort, dependencies, worktree flag
3. Read the **Scope** section to extract: files/dirs affected, files NOT to touch
4. Check `docs/plans/active/` for any currently-running plans
5. Display a summary table:

```
Plan Queue Status
═══════════════════════════════════════════════════════════════════
| # | Pri | Project       | Plan                    | Effort | Deps    | Scope                    |
|---|-----|---------------|-------------------------|--------|---------|--------------------------|
| 1 | 01  | receipts      | api-pagination          | medium | none    | app/views/, frontend/... |
| 2 | 02  | receipts      | user-profiles           | medium | none    | accounts/, frontend/...  |
| 3 | 03  | fed-memes     | imessage-scaffold       | high   | none    | FedMemes/                |
| 4 | 04  | tron-castle   | balance-pass            | low    | none    | game.js                  |

Active: [list any active plans or "none"]
```

## Step 2: Check Dependencies

For each queued plan:
1. If `Dependencies` lists other plan filenames, check if those are in `done/`
2. If a dependency is NOT in `done/`, mark the plan as **blocked** and skip it
3. Report blocked plans to the user

## Step 3: Check for File Conflicts

For each pair of dispatchable plans:
1. Compare the `Scope` sections — look for overlapping files or directories
2. If overlap exists, flag it with severity:
   - **Hard conflict:** Same file in both scopes → cannot run in parallel
   - **Soft conflict:** Parent/child directory overlap → warn, may be safe with ownership zones
3. Record conflict pairs for strategy selection

## Step 4: Select Execution Strategy

This is the critical decision. Analyze the dispatchable plans and select the best strategy.

### Strategy Selection Algorithm

```
1. Group plans by project (using Metadata → Project field)
2. For each project group:
   a. If group has 1 plan → candidate for SUBAGENT
   b. If group has 2+ plans:
      - Check file conflicts within group
      - If no conflicts → candidate for PARALLEL SUBAGENTS (same project, different zones)
      - If conflicts exist → candidate for AGENT TEAM (needs coordination)
      - If plans have phase dependencies → AGENT TEAM (needs handoffs)
3. Cross-project groups: always PARALLEL SUBAGENTS (independent)
```

### Strategy Definitions

#### Strategy A: Agent Team (Coordinated Same-Project Work)

**Use when:** 2+ plans target the same project AND have file conflicts, phase dependencies, or would benefit from a shared coordinator.

**How it works:**
1. Create an Agent Team with TeamCreate: `team_name: "{project}-dispatch-{date}"`
2. Create a team lead task: coordinate execution of all plans in the group
3. Spawn specialized teammates based on plan content:
   - **plan-executor** teammates for implementation phases
   - **test-writer** teammate if plans include test expansion
   - **docs-agent** teammate if plans include documentation work
   - **reviewer** teammate for quality gates on high-effort plans
4. Create tasks from plan phases (5-6 tasks per teammate, combine small phases)
5. Assign tasks to teammates based on file ownership zones
6. Lead coordinates, resolves conflicts, ensures handoffs

**Team composition templates:**

| Scenario | Lead | Teammates |
|----------|------|-----------|
| Feature development (2-3 plans) | Coordinator (delegate mode) | 2-3 plan-executors + 1 reviewer |
| Test expansion (2+ plans) | Coordinator | 2-3 test-writers |
| Mixed (implementation + docs) | Coordinator | plan-executors + docs-agent |
| Large refactor (3+ plans) | Coordinator (delegate mode) | plan-executors + test-writer + reviewer |

**Teammate spawning pattern:**
```
Use the Task tool with:
  subagent_type: "general-purpose"  (or custom agent type from .claude/agents/)
  team_name: "{team-name}"
  name: "{role}-{n}"  (e.g., "backend-1", "test-writer-1")
  mode: "plan"  (require plan approval for safety)
  prompt: |
    You are the {role} teammate on team {team-name}.
    Your file ownership zone: {zone from project CLAUDE.md}

    Read the team config at ~/.claude/teams/{team-name}/config.json to discover teammates.
    Check TaskList for your assigned tasks.
    Work through tasks in ID order. Mark each completed when done.
    Message the team lead if you hit blockers.

    Project conventions: read {project}/CLAUDE.md before starting.
```

#### Strategy B: Parallel Subagents (Independent Work)

**Use when:** Plans target different projects OR same project with zero file overlap.

**How it works:**
1. Spawn one subagent per plan using the Task tool
2. Each subagent gets the full plan content as its prompt
3. Subagents run independently — no coordination needed
4. Track completion via Task tool results

**Subagent spawning pattern:**
```
Use the Task tool with:
  subagent_type: "plan-executor"  (custom agent from .claude/agents/)
  mode: "default"
  prompt: |
    You are executing a plan from the workspace plan queue. Read and follow this plan exactly:

    [FULL PLAN CONTENT]

    Rules:
    - Use superpowers:executing-plans to implement this plan task-by-task
    - Check off each phase as you complete it
    - Run the project's test suite after each phase
    - If blocked, add a ## Blockers section to the plan and stop
    - When done, confirm all acceptance criteria pass
```

If `--parallel N` is set, limit concurrent subagents to N. Queue the rest.

#### Strategy C: Single Agent (One Plan)

**Use when:** Only one dispatchable plan exists, or user selected a single plan.

**How it works:** Same as Strategy B but with just one agent. Simplest path.

### Strategy Selection Display

Before dispatching, show the selected strategy:

```
Execution Strategy
═══════════════════════════════════════════════════════════════════
Strategy: MIXED (1 Agent Team + 2 Parallel Subagents)

  Team "receipts-dispatch-2026-02-13":
    Plans: 01-receipts-api-pagination, 02-receipts-user-profiles
    Reason: Same project, overlapping scope in frontend/src/
    Composition: Lead (coordinator) + backend-1 + frontend-1 + reviewer

  Subagent 1: 03-fed-memes-imessage-scaffold
    Reason: Independent project, no conflicts

  Subagent 2: 04-tron-castle-balance-pass
    Reason: Independent project, no conflicts

Total agents: 6 (4 team + 2 subagent)
═══════════════════════════════════════════════════════════════════
```

## Step 5: Confirm and Dispatch

### If `--dry-run`:
Show the strategy selection and stop.

### Otherwise:
Use AskUserQuestion to confirm the strategy. Offer options:
1. **Proceed with recommended strategy** (recommended)
2. **Force all as parallel subagents** (ignore coordination)
3. **Force all into one team** (maximum coordination)
4. **Pick specific plans** (manual selection)

Then execute the confirmed strategy:

**For Agent Teams:**
1. Move all plans in the group from `queue/` to `active/`
2. Create the team with TeamCreate
3. Create tasks from plan phases using TaskCreate
4. Spawn teammates using the Task tool with `team_name`
5. Assign tasks with TaskUpdate
6. Monitor progress — the lead coordinates
7. When team completes, move plans to `done/` (or `failed/`)
8. Clean up team with TeamDelete

**For Parallel Subagents:**
1. Move each plan from `queue/` to `active/`
2. Spawn subagents (up to `--parallel N` concurrent)
3. When each completes, move its plan to `done/` or `failed/`

## Step 6: Report

After all dispatched work completes (or fails), show a summary:

```
Dispatch Complete
═══════════════════════════════════════════════════════════════════
Strategy Used: Mixed (1 Team + 2 Subagents)

Team "receipts-dispatch-2026-02-13":
  ✓ 01-receipts-api-pagination — completed
  ✓ 02-receipts-user-profiles — completed
  Team duration: ~12 min, 4 teammates

Subagents:
  ✓ 03-fed-memes-imessage-scaffold — completed
  ✗ 04-tron-castle-balance-pass — failed (see docs/plans/failed/)

Summary: 3 completed, 1 failed, 0 blocked
Remaining in queue: 0
═══════════════════════════════════════════════════════════════════
```

## Error Handling

- If a plan file is malformed (missing required sections), warn and skip it
- If a plan's target project doesn't exist in /Apps, warn and skip it
- If an Agent Team fails to create, fall back to parallel subagents for that group
- If a teammate gets stuck, the lead should reassign the task or report the blocker
- Never delete plans — only move between queue/active/done/failed
- If `claude -p` is not available (non-headless context), use Task tool agents (current behavior)

## Custom Agent Types

The workspace provides custom agent definitions in `/Users/trey/Desktop/Apps/.claude/agents/`:

| Agent | Role | Can Edit Files? |
|-------|------|-----------------|
| `plan-executor` | Execute plan phases with testing | Yes |
| `test-writer` | Write tests without modifying source | Yes (test files only) |
| `docs-agent` | Update documentation | Yes (docs only) |
| `reviewer` | Read-only code review | No |

Use these as `subagent_type` values when spawning teammates or subagents. If a custom agent type matches the plan's work, prefer it over `general-purpose` for better scoping.
