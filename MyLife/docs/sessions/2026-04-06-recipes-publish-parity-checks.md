# 2026-04-06 Recipes Publish Parity Checks

## Summary

Prepared the pending recipes/mobile-web UIUX work for publish, cleaned duplicate artifact files, and fixed repo validation so parity checks work in the current hub-only MyLife layout.

## What Changed

- Removed accidental duplicate artifacts with ` 2` suffixes before staging.
- Fixed a stale eslint suppression in `apps/mobile/app/(recipes)/add-recipe.tsx` that blocked the function gate.
- Updated `apps/mobile/app/(recipes)/__tests__/index.test.tsx` to partially mock `@mylife/recipes` and cover the newer token/data exports used by the redesigned home screen.
- Expanded `apps/mobile/test/setup.tsx` so `lucide-react-native` named icon imports resolve in tests, not just `icons.*`.
- Updated parity tooling to skip standalone-specific assertions when `.gitmodules` and local `My*` standalone repos are absent:
  - `scripts/check-standalone-repos.mjs`
  - `scripts/check-module-parity.mjs`
  - `apps/web/test/parity/standalone-passthrough-matrix.test.ts`
- Left the recipes/mobile-web screen changes and related session docs staged for publish together.

## Why

`pnpm check:parity --quiet` was failing before it reached the real hub checks because the repo no longer has `.gitmodules` or local standalone app directories. The recipes test also lagged behind the redesigned screen imports.

## Verification

- `pnpm --dir apps/mobile run typecheck`
- `pnpm check:parity --quiet`
- `pnpm gate:function:changed`
  - Initially failed on a stale eslint suppression in `add-recipe.tsx`; fixed.
  - The gate then reached lint and typecheck successfully but still inherited unrelated mobile test-wrapper behavior.
- Bounded direct runs of `pnpm --dir apps/mobile exec vitest run "app/(recipes)/__tests__/index.test.tsx"` still hung after startup with no final output, so there is no clean green result from Vitest for that targeted test in this session.

## Remaining Notes

- The mobile Vitest runner still appears to hang during direct recipes test execution even after the mock updates. That looks separate from the parity/tooling fixes and should be debugged independently if it keeps blocking focused test runs.
