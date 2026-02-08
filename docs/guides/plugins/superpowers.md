# Superpowers Plugin — User Guide

**Category:** Plugin
**Scope:** Project-scoped (installed per-project via `.claude/settings.json`)
**Projects using this:** receipts, EasyStreet (native), easystreet-monorepo
**Last updated:** 2026-02-08

## What It Does

Superpowers is a Claude Code plugin that enforces disciplined development practices through 15 skills that trigger automatically based on context. It covers the full development lifecycle: design, planning, implementation (TDD), debugging, code review, and branch completion. Skills activate when Claude detects matching conditions in the conversation.

## Setup

### Prerequisites
- Claude Code CLI installed
- Active Claude Code subscription

### Installation

```bash
claude plugin install superpowers@claude-plugins-official
```

### Configuration

Enable in project settings (`.claude/settings.json`):
```json
{
  "enabledPlugins": ["superpowers@claude-plugins-official"]
}
```

### Plugin Management

```bash
claude plugin update superpowers@claude-plugins-official   # Update to latest
claude plugin enable superpowers@claude-plugins-official    # Enable
claude plugin disable superpowers@claude-plugins-official   # Disable
```

## Usage

### Quick Start

1. Install the plugin: `claude plugin install superpowers@claude-plugins-official`
2. Skills activate automatically — no explicit invocation needed
3. When starting any conversation, the `using-superpowers` skill activates to establish available capabilities
4. Begin working normally — superpowers intercepts at the right moments

### Skill Inventory

#### Design & Planning

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:brainstorming` | Before any creative work — features, components, behavior changes | Socratic design refinement: asks clarifying questions and explores alternatives before implementation |
| `superpowers:writing-plans` | After design approval, when you have a spec or requirements | Creates detailed implementation plans with bite-sized tasks (2-5 min each) |

#### Implementation

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:test-driven-development` | Before ANY feature/bugfix implementation | Enforces RED-GREEN-REFACTOR: tests must fail before writing implementation |
| `superpowers:systematic-debugging` | When encountering bugs, test failures, or unexpected behavior | 4-phase root cause investigation — diagnosis before fixes, never guess |
| `superpowers:verification-before-completion` | Before claiming work is complete or fixed | Runs verification commands and confirms output before making success claims |

#### Execution & Parallelism

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:subagent-driven-development` | Multi-task plans in current session | Dispatches fresh subagent per task with 2-stage review |
| `superpowers:dispatching-parallel-agents` | 2+ independent tasks that can run concurrently | Parallel subagent workflows for independent tasks |
| `superpowers:executing-plans` | Executing plans in a separate session | Batch execution with human review checkpoints |
| `superpowers:using-git-worktrees` | Starting feature work needing isolation | Creates isolated git worktrees with safety verification |

#### Code Review & Completion

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:requesting-code-review` | After completing tasks, before merging | Pre-review checklist and severity triage |
| `superpowers:receiving-code-review` | When receiving review feedback | Technical rigor — verify suggestions, don't blindly agree |
| `superpowers:finishing-a-development-branch` | When implementation is complete and tests pass | Guides merge/PR/cleanup decision workflow |

#### Meta Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:using-superpowers` | Starting any conversation | Establishes how to find and use available skills |
| `superpowers:writing-skills` | Creating or editing skills | Best practices for skill authoring with testing and verification |

### Common Operations

| Operation | How | Example |
|-----------|-----|---------|
| Start a new feature | Just describe what you want to build | "Add a dark mode toggle to the settings page" |
| Debug an issue | Describe the bug or paste an error | "The login form shows a 500 error when submitting" |
| Plan implementation | Ask to plan before coding | "Let's plan how to implement the notification system" |
| Parallel work | Request multiple independent tasks | "Run linting, tests, and type checking in parallel" |
| Code review prep | Say you're ready for review | "I'm done with this feature, let's do a code review" |
| Create a worktree | Ask for isolated feature work | "Set up a worktree for the auth feature" |

### Advanced Usage

**Overriding TDD for quick fixes:** Superpowers enforces TDD by default. If you need to skip it for a trivial fix, explicitly say so: "Skip TDD for this one-line fix."

**Subagent workflows:** When superpowers dispatches parallel agents, each agent gets a fresh context. The orchestrator reviews all results before presenting them. This is ideal for:
- Running tests across multiple packages
- Generating code in multiple files simultaneously
- Performing independent research tasks

**Worktree integration:** The `using-git-worktrees` skill creates worktrees with safety checks:
- Verifies the branch doesn't already exist
- Sets up the worktree directory with proper naming
- Reminds you about port allocation for dev servers

## Integration with Other Tools

- **commit-commands plugin:** After superpowers guides you through implementation and verification, use `/commit` to stage and commit
- **code-review plugin:** After superpowers' `requesting-code-review` runs its pre-review checklist, the code-review plugin can run automated multi-agent review
- **pr-review-toolkit:** Complements superpowers' review skills with 6 specialized review agents
- **Custom project skills:** Superpowers works alongside project-specific skills (e.g., `/create-tests`, `/add-to-timeline`)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Skills not activating | Verify plugin is enabled: check `.claude/settings.json` → `enabledPlugins` |
| TDD enforced when not wanted | Explicitly tell Claude to skip TDD for this change |
| Subagents timing out | Large tasks may need to be broken down further; ask for smaller task chunks |
| Plugin version mismatch | Run `claude plugin update superpowers@claude-plugins-official` |

## References

- **Marketplace:** `claude-plugins-official` (Anthropic official marketplace)
- **Superpowers ecosystem marketplace:** `superpowers-marketplace` (Jesse Vincent) — additional plugins like chrome devtools, episodic memory
- **Example project:** `/Users/trey/Desktop/Apps/receipts/CLAUDE.md` — comprehensive superpowers integration with all 15 skills documented
