---
name: parity-check
description: "Runs and interprets MyLife parity validation between standalone apps and hub modules. Generates a structured drift report showing which modules pass, which fail, and specific mismatches. Use when the user says 'check parity', 'validate modules', 'parity report', 'drift check', or 'are standalone and hub in sync'."
user-invocable: true
argument-hint: "[module-name] (optional, checks all if omitted)"
allowed-tools: [Read, Bash, Glob, Grep]
---

# Parity Check Skill

The agent runs MyLife parity validation between standalone app repositories and their
corresponding hub modules, then generates a structured drift report. This skill is
read-only and never modifies files.

## Inputs

- An optional module name argument (e.g., `MyBudget`, `budget`, `workouts`). When
  omitted, all modules are checked.
- The agent normalizes the argument: `MyBudget` and `budget` both resolve to the
  `budget` module.

## Known Module Inventory

| Module ID | Standalone Repo | Table Prefix | Parity Mode (Web) | Status |
|-----------|-----------------|--------------|---------------------|--------|
| books     | MyBooks         | `bk_`        | passthrough         | implemented |
| budget    | MyBudget        | `bg_`        | passthrough         | implemented |
| car       | MyCar           | `cr_`        | passthrough         | implemented |
| fast      | MyFast          | `ft_`        | passthrough         | implemented |
| habits    | MyHabits        | `hb_`        | passthrough         | implemented |
| homes     | MyHomes         | --           | passthrough         | implemented |
| meds      | MyMeds          | `md_`        | design_only         | design_only |
| recipes   | MyRecipes       | `rc_`        | passthrough         | implemented |
| rsvp      | MyRSVP          | --           | adapter             | implemented |
| surf      | MySurf          | --           | passthrough         | implemented |
| words     | MyWords         | --           | passthrough         | implemented |
| workouts  | MyWorkouts      | `wk_`        | passthrough         | implemented |

## Step 1 -- Run Parity Checks

### Full suite (no argument provided)

Run the combined gate. This executes all four sub-checks sequentially:

```bash
pnpm check:parity
```

The combined gate is equivalent to:

```bash
pnpm check:standalone && pnpm check:module-parity && pnpm check:passthrough-parity && pnpm check:workouts-parity
```

If the combined gate fails partway through, run the remaining sub-checks individually
to collect the full picture:

1. `pnpm check:standalone` -- verifies standalone repo integrity (git metadata,
   remote HEAD alignment, .gitmodules consistency). Script:
   `scripts/check-standalone-repos.mjs`.
2. `pnpm check:module-parity` -- checks module inventory (package presence,
   definition.ts, hub route roots, package.json dependency wiring, route file counts).
   Script: `scripts/check-module-parity.mjs`.
3. `pnpm check:passthrough-parity` -- verifies web passthrough wrappers for books,
   budget, habits, and workouts; checks tsconfig aliases and next.config.ts wiring.
   Script: `scripts/check-passthrough-parity.mjs`.
4. `pnpm check:workouts-parity` -- strict MyWorkouts checks (seed data count, CRUD
   symbols, schema tables, UI token parity across standalone/hub page pairs). Script:
   `scripts/check-workouts-parity.mjs`.

Optionally, also run the Vitest-based passthrough matrix for the fullest coverage:

```bash
pnpm test:parity-matrix
```

This runs `apps/web/test/parity/standalone-passthrough-matrix.test.ts`, which covers
all 23 standalone repos (including standalone-only ones), enforces per-module web
passthrough wrapper content, and validates tsconfig/next.config host wiring for every
integrated module.

### Single module (argument provided)

When a specific module is requested, run only the checks relevant to that module:

1. Always run `pnpm check:standalone` (fast, covers all submodules).
2. Always run `pnpm check:module-parity` (covers the requested module among others).
3. Run `pnpm check:passthrough-parity` if the module has web passthrough enforcement
   (books, budget, habits, workouts, words, recipes, fast, homes, surf, car).
4. Run `pnpm check:workouts-parity` only if the requested module is `workouts`.

After running the scripts, filter the output to show only lines containing the module
name or its standalone repo name (e.g., filter for `books` and `MyBooks`).

## Step 2 -- Parse and Categorize Results

Read through all script output and classify each line:

- **PASS**: Lines starting with `OK` or test lines showing green/passing status.
- **WARN**: Lines starting with `WARN`. These indicate minor drift such as local vs
  remote HEAD mismatch, pending passthrough migrations, or design-only deferral.
- **FAIL**: Lines starting with `FAIL` or test failures. These are breaking parity
  issues that block merge.

Count totals for each category across all checks that were run.

## Step 3 -- Generate Drift Report

Format the findings using this template:

```
## Parity Report -- [YYYY-MM-DD]

### Summary
- X modules passing
- Y modules with warnings
- Z modules failing
- Checks run: [list which of the 4 checks plus parity-matrix were executed]

### Per-Module Details

#### [Module Name] -- [PASS | WARN | FAIL]

**Standalone repo:** [repo name] ([OK | issue description])
**Module package:** [present | missing] at modules/[id]/package.json
**Definition:** [present | missing] at modules/[id]/src/definition.ts
**Hub web root:** [present | missing] at apps/web/app/[id]/
**Hub mobile root:** [present | missing] at apps/mobile/app/([id])/
**Web dependency:** [wired | missing] in apps/web/package.json
**Mobile dependency:** [wired | missing] in apps/mobile/package.json
**Standalone web routes:** [count]
**Hub web routes:** [count]
**Standalone mobile routes:** [count]
**Hub mobile routes:** [count]
**Web passthrough:** [enforced | adapter | pending | n/a]

Issues:
- [specific issue 1]
- [specific issue 2]

Remediation:
- [action 1]
- [action 2]

[Repeat for each module with issues. For passing modules, a single summary line is
sufficient.]
```

## Step 4 -- Single-Module Deep Dive

When a specific module was requested, include additional detail beyond the standard
report:

### Route comparison

Use Glob to enumerate route files in both the standalone and hub locations:

- Standalone web: `[StandaloneRepo]/apps/web/app/**/*.tsx`
- Standalone mobile: `[StandaloneRepo]/apps/mobile/app/**/*.tsx`
- Hub web: `apps/web/app/[moduleId]/**/*.tsx`
- Hub mobile: `apps/mobile/app/([moduleId])/**/*.tsx`

List routes present in standalone but missing from hub, and vice versa.

### Passthrough wrapper verification

For passthrough modules, read each hub web route file and verify it contains only a
thin re-export line like:

```
export { default } from '@my[module]-web/app/[path]';
```

Report any hub files that contain actual component logic instead of a wrapper.

### Schema/table check

Read `modules/[id]/src/definition.ts` and check for the expected `tablePrefix` value
from the inventory table above.

If the module has a schema file at `modules/[id]/src/db/schema.ts`, verify the table
names use the correct prefix.

### Feature inventory

Read the standalone app's main page/screen files and the hub's corresponding files.
List any features (buttons, sections, data displays) visible in standalone but absent
from hub, or vice versa.

## Step 5 -- Remediation Guidance

For each failure, provide specific fix actions:

| Failure Type | Remediation |
|-------------|-------------|
| Missing module package | Create `modules/[id]/package.json` with `@mylife/[id]` name |
| Missing definition.ts | Scaffold `modules/[id]/src/definition.ts` implementing `ModuleDefinition` |
| Missing hub route root | Create route directory under `apps/web/app/[id]/` or `apps/mobile/app/([id])/` |
| Missing package dependency | Add `@mylife/[id]` to the relevant app's `package.json` dependencies |
| Passthrough wrapper incorrect | Replace hub file content with thin re-export from standalone alias |
| Route count mismatch | Identify missing routes and create passthrough wrappers or adapter pages |
| Standalone HEAD drift | Pull latest in the standalone submodule directory |
| Missing tsconfig alias | Add `@my[module]-web/*` path alias in `apps/web/tsconfig.json` |
| Missing next.config transpile | Add standalone packages to `transpilePackages` in `apps/web/next.config.ts` |
| Seed data count mismatch | Sync exercise seed data between standalone and hub |
| Missing CRUD symbol | Add the missing exported function to `modules/[id]/src/db/crud.ts` |
| Schema table missing | Add the table definition with the correct prefix to the schema file |

Always note that parity validation failure is a release blocker per CLAUDE.md policy.

## Reference Scripts

The parity checks are implemented in these files (read them for exact check logic):

- `scripts/check-standalone-repos.mjs` -- standalone repo integrity
- `scripts/check-module-parity.mjs` -- module inventory and route counts
- `scripts/check-passthrough-parity.mjs` -- web passthrough wrapper enforcement
- `scripts/check-workouts-parity.mjs` -- strict MyWorkouts UI/data parity
- `apps/web/test/parity/standalone-passthrough-matrix.test.ts` -- Vitest parity matrix

## Constraints

- This skill is read-only. The agent must not create, modify, or delete any files.
- Only run the pnpm scripts listed above. Do not run build, install, or dev commands.
- Report findings with absolute file paths so the user can act on them.
- Do not suggest running `pnpm check:parity` as a CI gate -- it is already configured
  as one per CLAUDE.md policy.
