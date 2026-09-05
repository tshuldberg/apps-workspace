---
name: domain-engine-benchmarker
description: >-
  Generates skill-driven evals and test suites for MyLife domain engines
  (budget calculations, cycle prediction, workout state machines, reading
  progress, ingredient parsing, etc). Reads engine source code, identifies
  pure functions with clear I/O contracts, and produces evals.json files
  compatible with skill-creator benchmarking. Use when asked to benchmark
  an engine, test domain logic, generate evals for a module, write engine
  tests, or audit test coverage for business logic. Do NOT use for general
  unit testing or UI component tests (use test-writer agent instead).
argument-hint: "[module-name or engine-file-path]"
allowed-tools: Read, Write, Glob, Grep, LSP, Bash(git:*), Bash(wc:*)
---

# Domain Engine Benchmarker

You generate comprehensive, eval-ready test suites for MyLife's domain engines.
Your output is directly feedable to `/skill-creator` in eval and benchmark mode.

## Step 1: Identify Target Engine

- If `$ARGUMENTS` specifies a module name (e.g., `habits`, `books`, `budget`),
  scan `modules/$ARGUMENTS/src/` for engine files.
- If a file path is given, analyze that specific engine.
- If no argument, scan ALL modules for untested engines (highest priority).

Use LSP `documentSymbol` to enumerate exported functions. Look for:
- Files named `*-engine.ts`, `*-calculator.ts`, `*-prediction.ts`, `*-detector.ts`
- Directories named `engine/`, `stats/`, `analytics/`, `cycle/`, `challenges/`
- Functions with typed parameters and return values (pure functions)

## Step 2: Analyze Engine Contract

For each engine function, extract:
- **Signature**: name, parameters (with types), return type
- **Domain rules**: business logic encoded in the function (read the source)
- **Edge cases**: boundary conditions (empty arrays, zero values, date boundaries)
- **Dependencies**: what the function reads from DB vs computes purely

Classify each function:
- **Pure**: no side effects, deterministic -- IDEAL for evals
- **DB-dependent**: reads from SQLite -- needs mock data setup
- **Stateful**: modifies state -- needs before/after assertions

## Step 3: Check Existing Coverage

Glob for `**/__tests__/**` in the module. For each engine function:
- Does a test file exist? If yes, read it to understand current assertions.
- What's NOT tested? These are the highest-value eval targets.

## Step 4: Generate Eval File

Create `evals/evals.json` for the engine skill with 3-5 test cases:

```json
{
  "skill_name": "<module>-<engine>-benchmark",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic prompt triggering this engine logic",
      "expected_output": "What correct behavior looks like",
      "files": [],
      "expectations": [
        {
          "name": "descriptive-assertion-name",
          "assertion": "Objectively verifiable assertion"
        }
      ]
    }
  ]
}
```

### Assertion Quality Rules

- Test COMPUTATION correctness: "3 cycles of [30,29,31] days predicts next period in 30 days"
- Test BOUNDARY conditions: "Empty array input returns null, not error"
- Test STATE transitions: "idle -> START -> playing -> PAUSE -> paused -> RESUME -> playing"
- Name assertions descriptively: `cycle-avg-30-days`, `empty-input-returns-null`

## Step 5: Generate Test File

Write a Vitest test file at `modules/<name>/src/__tests__/<engine>.test.ts`:

- Import the engine functions directly
- Create test fixtures with known inputs/outputs derived from the domain rules
- Cover: happy path, edge cases, boundary conditions, error handling
- For DB-dependent functions, mock the database adapter

## Step 6: Validate

- Run `pnpm test --filter @mylife/<module>` to verify tests pass
- If tests fail, fix assertions (the engine is the source of truth, not the test)
- Report coverage: which functions are now tested vs still uncovered

## Priority Engines (Known Gaps)

| Module | Engine | Gap Severity | Key Functions |
|--------|--------|-------------|---------------|
| habits | cycle/prediction.ts | CRITICAL | predictNextPeriod(), estimateFertilityWindow() |
| workouts | workout/engine.ts | CRITICAL | reducePlayer(), playerProgress(), state transitions |
| books | challenges/challenge-engine.ts | HIGH | getChallengeStatus(), logBookCompletion() |
| books | progress/progress-engine.ts | HIGH | getReadingSpeed(), getProgressTimeline() |
| books | journal/journal-engine.ts | MEDIUM | calculateStreaks(), countWords() |
| meds | analytics/correlation.ts | MEDIUM | getMoodMedicationCorrelation() |

## Example

**User says:** "Benchmark the habits cycle prediction engine"

**Skill does:**
1. Reads `modules/habits/src/cycle/prediction.ts`
2. Extracts: `predictNextPeriod(periods: Period[])`, `estimateFertilityWindow(cycleStart, avgLength)`
3. Finds zero existing tests
4. Generates `evals/evals.json` with 3 test cases (regular cycles, irregular cycles, insufficient data)
5. Writes `modules/habits/src/__tests__/prediction.test.ts` with 8 test cases
6. Runs tests, reports results

**Result:** 8 passing tests covering cycle prediction with regular (28-30 day), irregular (21-45 day), and edge case (1 cycle only, 0 cycles) inputs.
