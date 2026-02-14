# Documentation Research: Agent Teams Best Practices

Date: 2026-02-13
Scope: Official Claude Code documentation on Agent Teams architecture, team composition, task assignment, coordination patterns, and when to use teams vs subagents.

## Sources (Official)
- https://code.claude.com/docs/en/agent-teams
- https://code.claude.com/docs/en/sub-agents

## Findings (Documented Facts)

### Agent Teams Architecture
1. **Team = Lead + Teammates.** The lead creates the team (TeamCreate), creates tasks (TaskCreate), spawns teammates (Task tool with `team_name`), and assigns work (TaskUpdate with `owner`). Teammates execute assigned tasks and report back.
2. **Shared task list.** Every team has a 1:1 correspondence with a task list at `~/.claude/tasks/{team-name}/`. All teammates can read and update tasks. Dependencies are tracked via `blockedBy`/`blocks` relationships.
3. **Inter-agent messaging.** Teammates communicate via SendMessage (direct messages) and broadcast. Messages are delivered automatically — no polling needed. The lead receives idle notifications when teammates complete their turn.
4. **Delegate mode.** Setting `mode: "delegate"` on a teammate restricts the lead to coordination only — no direct file edits. Forces clean separation of concerns.
5. **Plan approval gates.** Setting `mode: "plan"` on a teammate requires them to plan before implementing. The lead reviews and approves/rejects plans before execution begins.
6. **Teammate idle state is normal.** Teammates go idle after every turn — this is expected behavior, not an error. Sending a message to an idle teammate wakes them up.

### Subagents Architecture
7. **Subagents are isolated.** They execute a scoped task and return a result. No shared task list, no messaging between subagents.
8. **Agent types determine capabilities.** Available types: `general-purpose` (all tools), `Explore` (read-only search), `Plan` (read-only design), `Bash` (command execution), and custom types defined in `.claude/agents/`.
9. **Custom agents via frontmatter.** Place `.md` files in `.claude/agents/` with YAML frontmatter defining `name`, `description`, `allowed-tools`, and optional `model`. The markdown body becomes the system prompt.
10. **Background execution.** Subagents can run in background with `run_in_background: true`. Output is written to a file readable via TaskOutput or Read.
11. **Permission modes.** `bypassPermissions` skips all prompts (useful for trusted automated work), `plan` requires approval before implementation, `default` uses normal permission flow.

### Decision Matrix (When to Use Which)

12. **Use Agent Teams when:**
    - Tasks are interrelated and agents need to coordinate
    - Multiple agents work within the same project
    - Work requires phased execution with handoffs
    - Complex multi-phase features need a coordinator
    - File conflict avoidance needs active management

13. **Use Subagents when:**
    - Tasks are fully independent (no communication needed)
    - Only the result matters, not ongoing coordination
    - Work spans different projects with no overlap
    - Research/exploration tasks that just return findings
    - Simple focused tasks (tests, linting, docs)

14. **Task sizing for teams:** 5-6 tasks per teammate is the recommended sweet spot. Too few tasks means unnecessary overhead; too many means drift risk and context exhaustion.

15. **File ownership per teammate.** Each teammate should own different files/directories. The lead enforces this through task descriptions. The project's CLAUDE.md "Parallel Agent Work" section defines boundaries.

### Quality Gates
16. **Hooks for automation.** `TeammateIdle` and `TaskCompleted` hooks can trigger quality checks (lint, test, review) automatically when teammates finish turns or complete tasks.
17. **Display modes.** Teams can run in-process (single terminal, switch with Shift+Up/Down) or split across tmux panes (`"teammateMode": "tmux"` in settings).

### Custom Agent Definitions
18. **Frontmatter schema.** Required: `name`, `description`. Optional: `allowed-tools` (comma-separated), `model` (sonnet/opus/haiku), `memory` (user/project/local).
19. **The markdown body is the system prompt.** This is where role-specific instructions go — what the agent does, what conventions to follow, what files it owns.
20. **Agents inherit workspace context.** Custom agents still read CLAUDE.md and AGENTS.md from the workspace, so project-specific conventions apply automatically.

## Recommendations

### 1. Redesign `/dispatch` with a Strategy Selector

The current dispatch skill naively spawns one subagent per plan. Instead, `/dispatch` should analyze the queue and choose between three execution strategies:

| Strategy | When | How |
|----------|------|-----|
| **Agent Team** | 2+ plans target the same project | Create team with lead + specialized teammates; lead distributes tasks from the related plans |
| **Parallel Subagents** | Plans target different projects, no overlap | Spawn independent subagents (current behavior) |
| **Single Agent** | Only one plan in queue or trivial standalone work | Spawn one subagent (current behavior) |

The strategy selection should happen automatically based on plan metadata (project field, scope overlap analysis).

### 2. Create Custom Agent Definitions

Define reusable agent roles in `.claude/agents/` for common team compositions:

- `plan-executor.md` — General plan execution agent with testing + verification
- `test-writer.md` — Test-focused agent (read source, write tests only)
- `docs-agent.md` — Documentation-only agent (diagrams, CLAUDE.md, timeline)
- `reviewer.md` — Code review agent (read-only, provides feedback)

### 3. Add Team Composition Templates to the Guide

Document recommended team compositions for common scenarios:
- **Feature development:** Lead (coordinator) + Backend agent + Frontend agent + Test agent
- **Test expansion:** Lead + Test writer per module
- **Documentation sprint:** Lead + Docs agent per project
- **Refactoring:** Lead + Implementation agent + Review agent

### 4. Update All Project CLAUDE.md Files

Add a "Recommended Team Composition" subsection under each project's "Parallel Agent Work" section, mapping file ownership zones to named agent roles.

### 5. Add Team Quality Hooks

Configure `TeammateIdle` hooks to run project-specific test/lint commands automatically when teammates pause, catching issues early.

## Proposed Instruction Updates

- `/Users/trey/Desktop/Apps/.claude/skills/dispatch/SKILL.md`: Major rewrite — add strategy selection logic (Team vs Subagent vs Single), team composition templates, automatic project grouping
- `/Users/trey/Desktop/Apps/.claude/agents/plan-executor.md`: New file — custom agent for plan execution
- `/Users/trey/Desktop/Apps/.claude/agents/test-writer.md`: New file — custom agent for test writing
- `/Users/trey/Desktop/Apps/.claude/agents/docs-agent.md`: New file — custom agent for documentation
- `/Users/trey/Desktop/Apps/docs/guides/parallel-agent-orchestration.md`: Update Agent Teams section with strategy selection, team composition templates, custom agents
- `/Users/trey/Desktop/Apps/CLAUDE.md`: Update Agent Teams subsection in Plan Queue Protocol; add custom agents reference
- `/Users/trey/Desktop/Apps/AGENTS.md`: Sync Agent Teams updates
