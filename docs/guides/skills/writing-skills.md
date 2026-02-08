# Writing Claude Code Skills — User Guide

**Category:** Skill Authoring Guide
**Scope:** Workspace-wide reference
**Last updated:** 2026-02-08

## What It Does

Claude Code skills are reusable slash commands that encode workflows, enforce standards, and automate multi-step processes. A skill is a markdown file (`SKILL.md`) with YAML frontmatter that Claude Code loads and executes when invoked. This guide covers how to design, write, test, and maintain skills.

## Concepts

### Skill = SKILL.md + Supporting Files

```
.claude/skills/<skill-name>/
  SKILL.md            # Required — instructions and frontmatter
  template.md         # Optional — output templates
  checklist.md        # Optional — verification checklists
  reference.md        # Optional — detailed documentation
  examples/           # Optional — example files
```

### Scope Levels

| Scope | Location | Available To |
|-------|----------|-------------|
| Project | `<project>/.claude/skills/<name>/SKILL.md` | That project only |
| Workspace | `/Apps/.claude/skills/<name>/SKILL.md` | When working from `/Apps/` root |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All projects for this user |

### Invocation Models

| Model | Frontmatter | Behavior |
|-------|-------------|----------|
| Both (default) | (no special fields) | User types `/<name>` or Claude auto-invokes when description matches |
| User-only | `disable-model-invocation: true` | Only user can type `/<name>` — for risky ops (deploy, delete, send) |
| Claude-only | `user-invocable: false` | Claude invokes automatically — for background knowledge skills |

## Writing a Skill

### Step 1: Plan the Skill

Before writing, answer these questions:

1. **What does it do?** — One sentence describing the outcome
2. **Who invokes it?** — User-only, Claude-only, or both?
3. **Does it need arguments?** — What input does the user provide?
4. **Does it need dynamic context?** — Should it inject live data (git branch, date, file contents)?
5. **What tools does it need?** — Which tools should be pre-approved?
6. **Should it run in a subagent?** — Is the output large enough to justify isolation?

### Step 2: Write the SKILL.md

#### Frontmatter Reference

```yaml
---
name: my-skill                          # Required. lowercase, hyphens only
description: What this skill does       # Strongly recommended. Controls auto-invocation
argument-hint: [arg1] [arg2]            # Shown in slash menu autocomplete
disable-model-invocation: true          # User-only invocation (default: false)
user-invocable: false                   # Claude-only invocation (default: true)
allowed-tools: Read, Grep, Bash(git:*)  # Pre-approved tools (no per-use prompts)
model: claude-opus-4-6                  # Override model for this skill
context: fork                           # Run in isolated subagent context
agent: Explore                          # Subagent type: Explore, Plan, general-purpose
---
```

**All fields are optional except `name`.** But `description` is strongly recommended — it controls when Claude auto-invokes the skill.

#### Argument Substitution

| Variable | Description | Example |
|----------|-------------|---------|
| `$0` | First argument | `/my-skill receipts` → `$0` = `receipts` |
| `$1` | Second argument | `/my-skill receipts full` → `$1` = `full` |
| `$N` | Nth argument (0-based) | Any positional argument |
| `$ARGUMENTS` | All arguments as a single string | Everything after the skill name |

#### Dynamic Context Injection

Wrap shell commands in `` !`...` `` to inject their output before Claude processes the skill:

```markdown
Current date: !`date +%Y-%m-%d`
Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`
Changed files: !`git diff --stat HEAD~1 2>/dev/null`
```

The shell commands run before the skill body is sent to Claude. This lets skills adapt to the current state.

#### Body Best Practices

- **Keep SKILL.md under 500 lines.** Use supporting files for detailed docs
- **Use clear, imperative instructions.** "Read the file" not "You should read the file"
- **Structure with numbered steps.** Makes execution order unambiguous
- **Include examples where helpful.** Show expected input/output
- **Reference supporting files with relative links:** `See [checklist.md](checklist.md)`
- **Specify output format.** Tell Claude exactly what to produce

### Step 3: Choose `allowed-tools`

Pre-approve tools the skill needs so the user isn't prompted for each one:

```yaml
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(ls:*)
```

**Common patterns:**
| Skill Type | Suggested Tools |
|------------|-----------------|
| Research/analysis | `Read, Glob, Grep, Bash(git:*), Bash(ls:*), Bash(wc:*), Bash(du:*)` |
| Code generation | `Read, Write, Edit, Glob, Grep` |
| Git workflow | `Read, Edit, Bash(git:*), Bash(date:*)` |
| Full lifecycle | `Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(git:*), Skill` |

**Bash tool permissions use prefix matching:** `Bash(git:*)` allows any command starting with `git`. Be specific — `Bash(npm:*)` is better than `Bash(*)`.

### Step 4: Create Supporting Files (if needed)

For complex skills, add files alongside SKILL.md:

| File | Purpose | Example |
|------|---------|---------|
| `template.md` | Output format template | Research report template with section headings |
| `checklist.md` | Verification checklist | Steps to verify research completeness |
| `reference.md` | Detailed documentation | Comprehensive reference for complex domains |
| `entry-template.md` | Entry format template | Timeline entry format specification |

Reference them in SKILL.md: `Use the template at [template.md](template.md)`

### Step 5: Register the Skill

**This step is mandatory.** Add an entry to the Skills Registry:

**Project-level:** `<project>/.claude/skills/SKILLS_REGISTRY.md`
**Workspace-level:** `/Apps/.claude/skills/SKILLS_REGISTRY.md`

```markdown
| Skill | Description | Scope | Invocation | Created |
|-------|-------------|-------|------------|---------|
| `/my-skill` | What it does | Project | Both | 2026-02-08 |
```

### Step 6: Test the Skill

1. Restart Claude Code or start a new session (skills load at startup)
2. Type `/<skill-name>` to verify it appears in the slash menu
3. Invoke with test arguments
4. Verify the output matches expectations
5. Test auto-invocation by asking something matching the description

## Patterns from the Workspace

### Pattern 1: Research Skill (Explore Agent)

Used by `/research-app`. Runs in a fork to avoid overwhelming the main context:

```yaml
---
name: research-app
description: Analyze an app codebase and generate a structured research report
argument-hint: [project-path-or-name]
allowed-tools: Read, Write, Glob, Grep, Bash(ls:*), Bash(wc:*), Bash(git:*), Bash(du:*)
---
```

Key pattern: resolves a short name to a full path, reads documentation, analyzes code, writes a report to a standard location.

### Pattern 2: Timeline Management Skill

Used by `/add-to-timeline` in the receipts project. Uses dynamic context for git state:

```yaml
---
name: add-to-timeline
description: Append a dated session entry to timeline.md
argument-hint: [title]
allowed-tools: Read, Edit, Glob, Grep, Bash(git:*), Bash(date:*)
---
```

Key pattern: injects live git data via `` !`git log --oneline -10` ``, reads the end of the file, appends formatted entry.

### Pattern 3: Code Generation Skill

Used by `/create-skill` in the receipts project. User-only to prevent accidental invocation:

```yaml
---
name: create-skill
description: Create a new Claude Code skill with proper structure
argument-hint: [skill-name] [description]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash(mkdir:*), Glob, Grep
---
```

Key pattern: gathers requirements, creates directory, writes SKILL.md with proper frontmatter, registers in SKILLS_REGISTRY.md.

### Pattern 4: Onboarding Skill

Used by `/onboard-new-app` at the workspace level. Orchestrates multiple steps including invoking other skills:

```yaml
---
name: onboard-new-app
description: Onboard a new application into the /Apps workspace
argument-hint: [project-path]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(git:*), Bash(wc:*), Bash(du:*), Bash(mkdir:*), Skill
---
```

Key pattern: includes `Skill` in allowed-tools so it can invoke `/research-app` as a sub-step.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| SKILL.md over 500 lines | Extract details into supporting files |
| Missing `description` field | Add it — controls auto-invocation and slash menu display |
| Too-broad tool permissions (`Bash(*)`) | Use specific prefixes: `Bash(git:*)`, `Bash(npm:*)` |
| Forgetting to register in SKILLS_REGISTRY.md | Always add the registry entry — it's the index |
| Not restarting Claude Code after creating | Skills load at startup; restart or start a new session |
| Using `context: fork` for simple skills | Fork is for large-output skills; simple skills should run inline |
| Hardcoding absolute paths | Use `$0`/`$ARGUMENTS` for user input; reference workspace root via known paths |

## References

- **Workspace skills:** `/Users/trey/Desktop/Apps/.claude/skills/SKILLS_REGISTRY.md`
- **Receipts skills (reference implementations):** `/Users/trey/Desktop/Apps/receipts/.claude/skills/`
- **Create-skill skill (meta-skill):** `/Users/trey/Desktop/Apps/receipts/.claude/skills/create-skill/SKILL.md`
- **Skill authoring in superpowers:** `superpowers:writing-skills` auto-triggers when creating skills
