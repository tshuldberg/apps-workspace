# Scaling Claude Code: From 4 to 8+ Parallel Agents

> Research report — 2026-02-13

## The Core Shift: Conductor, Not Coder

At 4+ agents you stop writing code and start **orchestrating**. Each agent runs 5-20 minutes before needing attention, giving you a natural rotation window. The workflow becomes:

1. Pick highest-impact task → plan it (~15 min) → fire agent
2. Move to next task → plan → fire agent
3. Cycle back as agents finish or need feedback
4. Merge results, resolve conflicts, queue next batch

---

## Your Current Infrastructure (Already ~70% There)

| Asset | Status |
|-------|--------|
| `docs/plans/` with 8 plan files | Existing — good format |
| `superpowers:writing-plans` | Existing |
| `superpowers:executing-plans` | Existing |
| `superpowers:subagent-driven-development` | Existing |
| `superpowers:dispatching-parallel-agents` | Existing |
| `superpowers:using-git-worktrees` | Existing |
| tmux knowledge (`docs/guides/Tmux-Cheatsheet.md`) | Existing |
| **Plan queue/dispatch system** | **MISSING — the glue** |
| **Worktree lifecycle management** | **MISSING — manual today** |
| **Conflict detection** | **MISSING** |

---

## The Missing Pieces: 3-Tier System

### Tier 1: Plan Queue Directory Convention

Add this structure to your workspace:

```
/Users/trey/Desktop/Apps/
  docs/plans/
    queue/           ← Plans waiting for execution
    active/          ← Currently being worked on
    done/            ← Completed plans (archive)
    failed/          ← Plans that hit blockers
    templates/       ← Reusable plan templates
```

**Plan file naming convention:**
```
[priority]-[project]-[brief-description].md
01-receipts-api-pagination.md
02-easystreet-holiday-calculator-update.md
03-fed-memes-imessage-extension-scaffold.md
```

Priority prefix (01-05) controls execution order. Lower = higher priority.

**Minimum plan file template:**

```markdown
# Plan: [TITLE]

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

## Metadata
- **Project:** [project-name]
- **Priority:** [1-5]
- **Effort:** [low/medium/high]
- **Dependencies:** [none, or filenames of plans that must complete first]
- **Worktree:** [yes/no — does this need isolation?]
- **Created:** YYYY-MM-DD

## Objective
[1-3 sentences]

## Scope
- **Files/dirs affected:** [explicit list]
- **Files NOT to touch:** [guardrails]

## Phases
- [ ] Phase 1: [Description]
  - Acceptance: [how to verify]
- [ ] Phase 2: [Description]
  - Acceptance: [how to verify]

## Acceptance Criteria
- [ ] All tests pass
- [ ] No lint errors
- [ ] Timeline/changelog updated

## Constraints
- Do NOT modify files outside Scope
- [Additional guardrails]
```

### Tier 2: Session Management Tooling

**Recommended: `cmux`** — Purpose-built worktree + tmux lifecycle manager.

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/craigsc/cmux/main/install.sh | sh

# Usage — each command creates a worktree + tmux window + launches Claude
cmux new auth-oauth2           # Spawns worktree + opens Claude
cmux new dashboard-charts      # Second parallel agent
cmux new test-coverage         # Third
cmux ls                        # List all active worktrees/sessions
cmux merge auth-oauth2         # Merge back to main + cleanup
cmux rm auth-oauth2            # Remove without merging
```

Per-project bootstrap via `.cmux/setup`:
```bash
#!/bin/bash
REPO_ROOT="$(git rev-parse --git-common-dir | xargs dirname)"
ln -sf "$REPO_ROOT/.env" .env 2>/dev/null
npm ci  # or poetry install, bundle install, etc.
```

**Alternative tools worth knowing:**
| Tool | Best For | URL |
|------|----------|-----|
| `cmux` | Full worktree lifecycle + tmux | github.com/craigsc/cmux |
| `dmux` | Interactive multiplexer TUI | github.com/formkit/dmux |
| `workmux` | Opinionated Rust tool, fast | github.com/raine/workmux |
| `claude-tmux` | Popup-based session manager | github.com/nielsgroen/claude-tmux |
| `CCManager` | Multi-tool (Claude + Gemini + Cursor) | github.com/kbwo/ccmanager |
| GitButler | No worktrees — auto-branches per session | blog.gitbutler.com/parallel-claude-code |

### Tier 3: Agent Teams (Built-In, Experimental)

Anthropic's native multi-agent orchestration. Enable it:

```json
// .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Then tell Claude to create a team:
```
Create an agent team with 4 teammates:
- Auth specialist: migrate login to OAuth2 (src/auth/)
- Frontend dev: build dashboard charts (src/components/dashboard/)
- Test engineer: write integration tests (tests/)
- DevOps: update CI pipeline (.github/, config/)
```

Features: shared task list with dependencies, inter-agent messaging, file-lock task claiming, `Shift+Up/Down` to switch between agents in one terminal, or tmux split mode.

**Best for:** When all work is in one project and you want automated coordination.
**Not ideal for:** Cross-project work across your /Apps workspace (use plan queue + cmux instead).

---

## Task Decomposition: The Independence Test

Before spawning agents, every task pair must pass this test:

| Check | Pass? |
|-------|-------|
| Do they touch different files? | Required |
| Can each complete without waiting on the other? | Required |
| Do they belong to different modules/layers? | Strongly preferred |
| Is each 5-30 min of agent work? | Ideal size |

**Decomposition by layer (most reliable pattern):**

```
Agent 1: Database/models      → db/, models/
Agent 2: API/services         → api/, services/
Agent 3: Frontend/components  → components/, pages/
Agent 4: Tests                → tests/
Agent 5: Docs/config          → docs/, config/
```

**Decomposition by project (your workspace):**

```
Terminal 1: receipts backend work
Terminal 2: receipts frontend work
Terminal 3: fed-memes API scaffold
Terminal 4: easystreet-monorepo feature
Terminal 5: automation-hub new adapter
Terminal 6: tron-castle-fight balancing
Terminal 7: macos-hub new tool
Terminal 8: research/planning (your conductor terminal)
```

---

## Community Automation Tools

### continuous-claude — Loop Runner
Runs Claude in a loop, creating PRs, checking CI, merging — unattended.

```bash
continuous_claude --prompt "Write tests for all uncovered functions" \
  --max-runs 20 --max-cost 50 --worktree test-coverage \
  --completion-signal "CONTINUOUS_CLAUDE_PROJECT_COMPLETE"
```

Uses `SHARED_TASK_NOTES.md` as inter-iteration memory. Each iteration reads previous notes, works, updates notes. Exits when Claude outputs the signal phrase 3x in a row.

Source: github.com/AnandChowdhary/continuous-claude

### parallel-cc — Cloud Sandbox Dispatch
Dispatches plan files to cloud sandboxes in parallel:

```bash
parallel-cc sandbox run --repo . --multi \
  --task-file tasks.txt --max-concurrent 5
```

Source: github.com/frankbria/parallel-cc

### CCPM — PRD-to-Plan Pipeline
Full PM lifecycle: PRD → Epic → GitHub Issues → Worktree agents.

```bash
/pm:prd-new        → Create product requirements doc
/pm:prd-parse      → Extract epic with architecture decisions
/pm:epic-decompose → Individual task files
/pm:epic-sync      → Push as GitHub Issues (distributed queue)
/pm:issue-start 42 → Launch agent on issue in its own worktree
```

Source: github.com/automazeio/ccpm

### planning-with-files — Persistent 3-File Planning
Plugin that enforces `task_plan.md` + `findings.md` + `progress.md`:

```bash
# Install as Claude Code plugin
# (check GitHub for current install method)
```

Rules: create plan first, save findings every 2 operations, log ALL errors, mutate on failure (never retry identical approach).

Source: github.com/OthmanAdi/planning-with-files

### Backlog.md — Git-Native Task Queue with MCP
Stores tasks as markdown with YAML frontmatter. Exposes MCP tools so agents can `createTask`, `editTask`, `listTasks`.

Source: github.com/MrLesk/Backlog.md

---

## The Claude Agent SDK — Programmatic Plan Queue

For maximum control, the Agent SDK lets you build a custom plan runner in TypeScript or Python:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readdir, readFile, rename } from "fs/promises";
import { join } from "path";

async function executePlan(planContent: string, workDir: string) {
  let result = "";
  for await (const message of query({
    prompt: `Execute this implementation plan:\n\n${planContent}`,
    options: {
      allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
      cwd: workDir,
    },
  })) {
    if ("result" in message) result = message.result;
  }
  return result;
}

async function runQueue(plansDir: string) {
  const files = (await readdir(plansDir))
    .filter(f => f.endsWith(".md"))
    .sort(); // priority prefix sorts naturally
  for (const file of files) {
    const content = await readFile(join(plansDir, file), "utf-8");
    console.log(`Executing: ${file}`);
    await executePlan(content, ".");
    await rename(join(plansDir, file), join(plansDir, "../done", file));
  }
}

runQueue("./docs/plans/queue");
```

The SDK also supports session resumption and subagent definitions.

Sources: github.com/anthropics/claude-agent-sdk-typescript, github.com/anthropics/claude-agent-sdk-python

---

## Simple Bash Queue Runner (Start Here)

```bash
#!/bin/bash
# plan-runner.sh — Feed plan files to Claude Code sequentially
set -euo pipefail

PLANS_DIR="${1:-docs/plans}"
QUEUE="$PLANS_DIR/queue"
DONE="$PLANS_DIR/done"
FAILED="$PLANS_DIR/failed"
LOGS="$PLANS_DIR/logs"

mkdir -p "$DONE" "$FAILED" "$LOGS"

for plan_file in $(ls "$QUEUE"/*.md 2>/dev/null | sort); do
  plan_name=$(basename "$plan_file" .md)
  timestamp=$(date +%Y%m%d-%H%M%S)
  log_file="$LOGS/${plan_name}-${timestamp}.json"

  echo "=== Starting: $plan_name ==="

  if claude -p "Execute this plan completely. Check off each phase as you complete it. If blocked, explain what blocked you.

$(cat "$plan_file")" \
    --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
    --output-format json > "$log_file" 2>&1; then
    mv "$plan_file" "$DONE/"
    echo "=== Completed: $plan_name ==="
  else
    mv "$plan_file" "$FAILED/"
    echo "=== FAILED: $plan_name (see $log_file) ==="
  fi
done

echo "Queue empty."
```

**Parallel version with worktrees:**

```bash
#!/bin/bash
# parallel-plan-runner.sh
MAX_CONCURRENT=${1:-4}

run_plan() {
  local plan_file="$1"
  local plan_name=$(basename "$plan_file" .md)
  local worktree_dir="../Apps-${plan_name}"

  git worktree add "$worktree_dir" -b "plan/${plan_name}" 2>/dev/null
  cd "$worktree_dir"
  claude -p "$(cat "$plan_file")" \
    --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
    --output-format json > "plan-result.json" 2>&1
  cd -
  echo "Done: $plan_name"
}

export -f run_plan

ls docs/plans/queue/*.md 2>/dev/null | \
  xargs -P "$MAX_CONCURRENT" -I {} bash -c 'run_plan "$@"' _ {}
```

---

## Scaling Limits (Community Consensus)

| Agents | Best For | Coordination Overhead | Token Multiplier |
|--------|----------|-----------------------|------------------|
| 2-3 | Active development, quick iteration | Low — track mentally | ~3x single |
| 4-6 | Feature development across modules | Medium — use tmux + naming | ~7x single |
| 6-8 | Large refactors, multi-project | High — use cmux or Agent Teams | ~12x single |
| 8+ | Massive parallel efforts | Very high — requires plan files + conflict detection | ~15x+ single |

**Key warning:** 8 agents is NOT 8x the tokens. Each agent explores its own context, makes its own mistakes, and backtracks independently. Budget 12-15x a single session when running 8 agents.

---

## Recommended Implementation Path

### Phase 1: Plan Queue Infrastructure (Do Now)
1. Create `docs/plans/queue/`, `done/`, `failed/`, `templates/` directories
2. Write the plan template file
3. Add Plan Queue Protocol section to CLAUDE.md
4. Write 3-5 plan files from your current backlog into the queue

### Phase 2: Session Tooling (This Week)
1. Install `cmux` for worktree lifecycle management
2. Set up `.cmux/setup` scripts for your active projects
3. Practice the rotation: plan → fire → rotate → merge cycle
4. Scale from 4 to 6 terminals

### Phase 3: Automation (Next Week)
1. Enable Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
2. Write the bash queue runner script
3. Test headless plan execution with `claude -p`
4. Scale to 8 terminals

### Phase 4: Full Orchestration (When Ready)
1. Evaluate Agent SDK for programmatic queue management
2. Consider `continuous-claude` for long-running autonomous loops
3. Add conflict detection (`clash` or manual file-overlap checks)
4. Build a `/dispatch` skill that reads from `docs/plans/queue/` and spawns agents

---

## Key Sources

**Official:**
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)
- [Claude Code Headless Mode](https://code.claude.com/docs/en/headless)
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)

**Community Tools:**
- [cmux](https://github.com/craigsc/cmux) — Worktree + tmux lifecycle
- [continuous-claude](https://github.com/AnandChowdhary/continuous-claude) — Loop runner
- [parallel-cc](https://github.com/frankbria/parallel-cc) — Parallel sandbox dispatch
- [ccpm](https://github.com/automazeio/ccpm) — PRD-to-plan pipeline
- [planning-with-files](https://github.com/OthmanAdi/planning-with-files) — 3-file planning
- [Backlog.md](https://github.com/MrLesk/Backlog.md) — MCP-enabled task queue
- [claude-flow](https://github.com/ruvnet/claude-flow) — MCP swarm orchestration
- [Clash](https://github.com/clash-sh/clash) — Merge conflict detection

**Guides & Analysis:**
- [Addy Osmani: Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Simon Willison: Parallel Coding Agents](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- [How to Run Coding Agents in Parallel (TDS)](https://towardsdatascience.com/how-to-run-coding-agents-in-parallell/)
- [Running Claude Code in a Loop (Anand Chowdhary)](https://anandchowdhary.com/blog/2025/running-claude-code-in-a-loop)
- [How I Run Agents in Parallel (WorksForNow)](https://worksfornow.pika.page/posts/note-to-a-friend-how-i-run-claude-code-agents-in-parallel)
- [GitButler: No-Worktree Parallel Sessions](https://blog.gitbutler.com/parallel-claude-code)
