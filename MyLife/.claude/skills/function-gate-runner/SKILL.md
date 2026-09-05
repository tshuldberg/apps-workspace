---
name: function-gate-runner
description: >-
  Runs the MyLife function quality gate (lint + typecheck + tests) on changed
  files with automatic package detection and per-function reporting. Wraps
  pnpm gate:function:changed with LSP integration for smarter file selection
  and richer output. Use when asked to run the gate, check changes, validate
  before commit, run quality checks, or verify function changes. Do NOT use
  for full test suite runs (use pnpm test) or standalone app testing (use
  gate:function --all-standalone).
allowed-tools: Read, Glob, Grep, Bash(pnpm:*), Bash(git:*), Bash(node:*), LSP
---

# Function Gate Runner

You run the mandatory function quality gate on changed code, with smarter
detection and clearer reporting than the raw script.

## Step 1: Detect Changed Files

```bash
git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' ':!*.test.*' ':!*.spec.*' ':!dist/'
```

If no changes detected, also check staged and unstaged:
```bash
git diff --name-only HEAD -- '*.ts' '*.tsx' ':!*.test.*'
git diff --name-only -- '*.ts' '*.tsx' ':!*.test.*'
```

## Step 2: Classify Changes

For each changed file:
1. Determine which package it belongs to (check nearest `package.json`)
2. Classify: hub package (`packages/`), module (`modules/`), app (`apps/`), standalone (`My*/`)
3. Use LSP `documentSymbol` to identify which exported functions changed

Report: "Found N changed functions across M packages"

## Step 3: Run Gate

Execute the gate per package:

```bash
pnpm gate:function --file <path> [--tests <related-test-paths>]
```

Or for bulk:
```bash
pnpm gate:function:changed
```

For standalone apps:
```bash
pnpm gate:function --standalone <AppName>
```

## Step 4: Report Results

For each package, report:
- Lint: PASS/FAIL (with specific errors if failed)
- TypeCheck: PASS/FAIL (with specific errors if failed)
- Tests: PASS/FAIL (with failing test names if failed)

If all pass: "All gates pass. Safe to commit."
If any fail: list exact errors with file:line references for quick fixes.

## Step 5: Suggest Fixes (if failures)

For lint failures: show the ESLint rule and fix suggestion.
For type failures: show the TypeScript error and likely fix.
For test failures: show the assertion that failed and expected vs actual.

## Constraints

- CLAUDE.md line 87: "For any code change that modifies function logic, run
  pnpm gate:function:changed before finalizing."
- Skip gate only if no function logic changed (state explicitly)
- Respect file ownership zones for parallel work

## Example

**User says:** "Run the quality gate on my changes"

**Skill does:**
1. Detects 3 changed files: `modules/budget/src/engine/budget.ts`, `modules/budget/src/db/categories.ts`, `packages/ui/src/components/Card.tsx`
2. Classifies: 2 in @mylife/budget, 1 in @mylife/ui
3. Runs gate for both packages
4. Reports: budget lint PASS, typecheck PASS, tests PASS; ui lint PASS, typecheck FAIL (missing prop type)
5. Shows: `Card.tsx:42 - Property 'variant' does not exist on type 'CardProps'`

**Result:** 1 failure. User fixes the type error and re-runs.
