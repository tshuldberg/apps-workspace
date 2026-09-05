# Function Quality Gate

This workflow is for validating newly written functions immediately after implementation.

It covers:
- Contract correctness tests
- Deterministic fuzz/property-style tests
- Complexity slope checks
- Memory budget checks
- Package lint, typecheck, and tests

## Shared Test Helpers

Use the shared helpers in:
- `test/vitest/function-quality.ts`

Available helpers:
- `runDeterministicFuzz`
- `assertComplexitySlope`
- `assertMemoryBudget`
- `randomInt`

The gate runner auto-detects `pnpm` when `node` is available and falls back to `bun` when running in Bun-only environments.

## 1) Scaffold a Function Gate Test

Create a test scaffold near your source file:

```bash
pnpm scaffold:function-test --file modules/books/src/stats/stats.ts --function calculateReadingStats
```

Optional flags:

```bash
pnpm scaffold:function-test --file MyBudget/packages/shared/src/engine/net-cash.ts --function calculateRunningBalance --expected nlogn
pnpm scaffold:function-test --file modules/books/src/stats/stats.ts --function calculateReadingStats --force
```

## 2) Run the Gate for One Package

Run by source file (auto-resolves package, auto-detects nearby tests):

```bash
pnpm gate:function --file modules/books/src/stats/stats.ts
```

Run for all changed source files in the current branch (recommended agent command):

```bash
pnpm gate:function:changed
```

Run explicit tests:

```bash
pnpm gate:function --file modules/books/src/stats/stats.ts --tests modules/books/src/stats/__tests__/stats.test.ts,modules/books/src/stats/__tests__/stats.function-gate.test.ts
```

Run by package directory:

```bash
pnpm gate:function --dir modules/books
```

Run by workspace package name:

```bash
pnpm gate:function --package @mylife/books
```

## 3) Standalone App Coverage

The same gate works for contained standalone apps.

Run one standalone root:

```bash
pnpm gate:function --standalone MyBooks
```

Run all standalone app roots:

```bash
pnpm gate:function --all-standalone
```

Useful for quick script validation:

```bash
pnpm gate:function --all-standalone --skip-test
```

## 4) Suggested Authoring Workflow

1. Write the function.
2. Scaffold test file with `pnpm scaffold:function-test`.
3. Fill in contract and invariants.
4. Run `pnpm gate:function --file <path>`.
5. Commit only when gate passes.

For multi-file changes, run `pnpm gate:function:changed` before finalizing.
