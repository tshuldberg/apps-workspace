---
name: module-claude-md-generator
description: >-
  Generates standardized CLAUDE.md files for MyLife modules and packages
  that currently lack documentation. Reads module source code, extracts
  exports, storage type, migration pattern, and test coverage, then produces
  a micro-CLAUDE.md following hub conventions. Use when asked to generate
  module docs, add CLAUDE.md to modules, document module contracts, or
  improve module documentation. Do NOT use for hub-level CLAUDE.md (edit
  directly) or standalone app docs (those have their own CLAUDE.md).
argument-hint: "[module-name or 'all']"
allowed-tools: Read, Write, Glob, Grep, LSP, Bash(wc:*)
---

# Module CLAUDE.md Generator

You generate standardized documentation for MyLife modules and packages that
currently have none.

## Step 1: Identify Targets

- If `$ARGUMENTS` names a module (e.g., `books`, `budget`), generate for that module only.
- If `$ARGUMENTS` is `all`, generate for ALL modules in `modules/` and packages in `packages/`.
- If no argument, scan for modules/packages missing CLAUDE.md and list them.

## Step 2: Extract Module Contract

For each target, read and extract:

1. **package.json**: name, version, dependencies, scripts
2. **src/index.ts**: exported types, functions, ModuleDefinition
3. **src/definition.ts**: id, name, tagline, icon, accentColor, tier, storageType, tablePrefix
4. **src/types/**: Zod schemas (list schema names and their shapes)
5. **src/db/**: table names, CRUD operations
6. **src/__tests__/**: test file count, what's covered

Use LSP `documentSymbol` on `src/index.ts` to enumerate all exports precisely.

## Step 3: Determine Module Metadata

- **Storage type**: sqlite | supabase | drizzle (from ModuleDefinition.storageType)
- **Table prefix**: from ModuleDefinition.tablePrefix
- **Standalone parity status**: check if `MyLife/<AppName>/` exists with runtime code
- **Test coverage**: count test files vs source files
- **Engine inventory**: list all `*-engine.ts`, `*-calculator.ts`, `*-prediction.ts` files

## Step 4: Generate CLAUDE.md

Write to `modules/<name>/CLAUDE.md` (or `packages/<name>/CLAUDE.md`):

```markdown
# @mylife/<name>

## Overview
[1-2 sentences from ModuleDefinition tagline + storage type]

## Exports
[Table of exported functions/types from index.ts]

## Storage
- **Type:** [sqlite | supabase | drizzle]
- **Table prefix:** [prefix]
- **Key tables:** [list from db/ directory]

## Engines
[List of engine files with their key functions]

## Schemas
[List of Zod schemas from types/ with brief descriptions]

## Test Coverage
- **Test files:** [count]
- **Covered:** [list of tested engines/functions]
- **Gaps:** [list of untested engines/functions]

## Parity Status
- **Standalone repo:** [exists/design-only/none]
- **Hub integration:** [wired/pending/n/a]
- **Parity gate:** [enforced/deferred/n/a]

## Key Files
[Short path list of the most important files to read first]
```

## Step 5: Validate

- Verify all sections are populated (no REPLACE placeholders)
- Verify exports list matches actual `index.ts` exports
- Verify test count matches actual test files

## Example

**User says:** "Generate CLAUDE.md for the habits module"

**Skill does:**
1. Reads `modules/habits/package.json`, `src/index.ts`, `src/definition.ts`
2. Extracts: id=habits, tier=premium, storageType=sqlite, prefix=hb_
3. Finds engines: cycle/prediction.ts (predictNextPeriod, estimateFertilityWindow)
4. Finds 1 test file, 0 engine tests (gap: prediction engine)
5. Writes `modules/habits/CLAUDE.md`

**Result:** Standardized CLAUDE.md with all 7 sections populated.
