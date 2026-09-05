---
name: parity-remediation
description: >-
  Runs MyLife parity gates, parses failures into categorized drift report,
  and suggests specific file-level fixes. Goes beyond parity-check by
  analyzing WHY parity failed and HOW to fix it. Categorizes drift by type
  (route, data model, UI component, API contract) and generates remediation
  steps. Use when parity fails, when asked to fix parity drift, remediate
  module mismatches, resolve standalone/hub divergence, or debug why parity
  check is failing. Do NOT use for initial parity validation only (use
  parity-check skill instead).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm:*), Bash(git:*), Bash(node:*), LSP
---

# Parity Remediation

You fix parity drift between MyLife standalone apps and hub modules. You don't
just report failures -- you categorize them, identify root causes, and generate
actionable remediation steps.

## Step 1: Run Parity Gates

Execute all 4 parity checks and capture output:

```bash
pnpm check:standalone 2>&1
pnpm check:module-parity 2>&1
pnpm check:passthrough-parity 2>&1
pnpm check:workouts-parity 2>&1
```

If all pass, report "All parity gates pass" and stop.

## Step 2: Parse Failures

For each failure, extract:
- **Module name** (e.g., books, budget, fast)
- **Gate** that failed (standalone, module-parity, passthrough-parity, workouts-parity)
- **Failure type**: classify as one of:
  - `route-mismatch`: routes exist in standalone but not hub (or vice versa)
  - `data-model-drift`: schema or table definitions differ
  - `ui-divergence`: component names, labels, or screen structure differ
  - `api-contract-break`: exported types or function signatures differ
  - `passthrough-break`: web wrapper doesn't correctly re-export from standalone alias
  - `config-drift`: package.json, tsconfig, or build config differs

## Step 3: Root Cause Analysis

For each failure, read the relevant files in BOTH standalone and hub:

- **Standalone path**: `MyLife/<AppName>/apps/web/app/` or `MyLife/<AppName>/apps/mobile/app/`
- **Hub path**: `MyLife/apps/web/app/<module>/` or `MyLife/modules/<module>/src/`

Use LSP `documentSymbol` or Grep to compare:
- Exported route names and paths
- Component exports and prop types
- Database table definitions and column names
- Zod schema shapes

Identify which side is the source of truth (standalone is always canonical per CLAUDE.md line 40).

## Step 4: Generate Remediation Report

Output a structured report:

```markdown
## Parity Remediation Report -- YYYY-MM-DD

### Summary
- X modules with drift
- Y total failures across Z gate types

### Module: [name]

**Gate:** [which check failed]
**Type:** [route-mismatch | data-model-drift | ...]
**Standalone (canonical):** [file path + relevant content]
**Hub (drifted):** [file path + relevant content]
**Fix:** [specific edit instructions]

[repeat per failure]

### Remediation Steps (ordered)
1. [first fix -- apply in both codebases per CLAUDE.md line 43]
2. [second fix]
...
N. Run `pnpm check:parity` to verify all gates pass
```

## Step 5: Apply Fixes (with confirmation)

Ask the user before applying fixes. For each fix:
1. Edit the hub-side file to match standalone (canonical source)
2. If the standalone has a bug, note it but do NOT change standalone without confirmation
3. After all fixes, run `pnpm check:parity` to verify

## Constraints

- Standalone apps are ALWAYS the source of truth (CLAUDE.md line 40)
- Any parity-impacting change must be applied in both codebases in the same session (CLAUDE.md line 43)
- Update both CLAUDE.md and AGENTS.md if rules change (CLAUDE.md line 56)
- Respect file ownership zones for Agent Team work (CLAUDE.md lines 207-218)

## Example

**User says:** "Parity check is failing on books and habits, can you fix it?"

**Skill does:**
1. Runs all 4 gates, captures: books passthrough-parity FAIL, habits module-parity FAIL
2. Categorizes: books = passthrough-break (wrapper not importing from alias), habits = route-mismatch (new standalone route not in hub)
3. Reads both sides: standalone MyBooks has `/reading-goals` route, hub books module missing it
4. Generates remediation: add `/reading-goals` route wrapper to `apps/web/app/books/reading-goals/page.tsx`
5. After user confirms, applies fix and re-runs parity gate

**Result:** Both gates pass. Drift resolved.
