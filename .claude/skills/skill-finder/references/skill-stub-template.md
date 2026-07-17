# Skill Stub Template

Use this template when generating draft SKILL.md files for identified opportunities.
Fill in all REPLACE sections. Remove this header comment block in the final output.

## Template

```markdown
---
name: REPLACE-skill-name
description: >-
  REPLACE: 1-2 sentences on what the skill does. THEN 1-2 sentences on when to
  use it, including specific trigger phrases users might say. Include anti-trigger
  conditions if there is risk of false activation. Keep under 1024 characters.
  Example: "Analyzes X and produces Y. Use when user asks to [trigger phrases].
  Do NOT use for [anti-trigger conditions]."
argument-hint: "REPLACE-or-remove-if-no-args"
allowed-tools: REPLACE-comma-separated-tools
---

# REPLACE Skill Name

## Overview

REPLACE: 2-3 sentences explaining what this skill does and why it exists.
What problem does it solve? What value does it deliver?

## Workflow

### Step 1: REPLACE -- Gather Context

REPLACE: What information does the skill need to collect before acting?
- What files to read
- What state to check
- What user input to clarify

### Step 2: REPLACE -- Core Action

REPLACE: The main work the skill performs.
- Specific operations
- Decision points
- Error handling

### Step 3: REPLACE -- Generate Output

REPLACE: What the skill produces.
- Output format
- File locations
- Summary to display

## Example

**User says:** "REPLACE: realistic user prompt"

**Skill does:**
1. REPLACE: step 1
2. REPLACE: step 2
3. REPLACE: step 3

**Result:** REPLACE: what the user sees

## Output Format

REPLACE: Exact structure of the output (markdown template, file format, etc.)

## Error Handling

- **REPLACE common error:** REPLACE: how to handle it
- **REPLACE edge case:** REPLACE: how to handle it

## Constraints

- REPLACE: files or directories that are off-limits
- REPLACE: conventions to follow from the project's CLAUDE.md
```

## Frontmatter Checklist

Before finalizing any stub, verify:

- [ ] `name` is kebab-case, matches directory name, 1-64 chars
- [ ] `description` includes WHAT + WHEN + anti-triggers, under 1024 chars
- [ ] `allowed-tools` lists only the tools actually needed (principle of least privilege)
- [ ] No XML angle brackets in frontmatter
- [ ] No "claude" or "anthropic" in the skill name

## Description Writing Guide

Structure the description as: **Capability + Triggers + Anti-triggers**

**Good:**
```yaml
description: >-
  Validates and formats budget envelope allocations across categories. Use when
  user asks to check budget math, validate allocations, audit envelope balances,
  or reconcile category totals. Do NOT use for subscription tracking or payment
  processing (use subscription-tracker skill instead).
```

**Bad:**
```yaml
description: Helps with budgets.
```

## Allowed-Tools Guide

Common tool sets by skill type:

| Skill Type | Typical Tools |
|-----------|---------------|
| Read-only analysis | `Read, Glob, Grep, LSP` |
| Code generation | `Read, Write, Edit, Glob, Grep, LSP` |
| Workflow automation | `Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(npm:*)` |
| MCP integration | `Read, Write, Glob, Grep` + specific MCP tools |
| Full access | `Read, Write, Edit, Glob, Grep, Bash, Agent, LSP` |

Prefer the narrowest set that enables the workflow. Add tools only when the
skill genuinely needs them.
