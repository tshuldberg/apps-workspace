# 2026-04-20 Competitor Ring Discover Implementation

## Summary

Implemented the first manifest-backed competitor replacement ring on the web app by adding a reusable rotating logo component and wiring it into the `/discover` page.

## What Changed

1. Added a reusable marketing component:
   - `apps/web/components/marketing/ReplaceCompetitorRing.tsx`
2. Added targeted tests for the new component:
   - `apps/web/components/marketing/__tests__/ReplaceCompetitorRing.test.tsx`
   - `apps/web/components/marketing/__tests__/ReplaceCompetitorRing.function-gate.test.ts`
3. Integrated the ring into the existing web discovery surface:
   - `apps/web/app/discover/page.tsx`
4. Replaced the placeholder generated page gate with a real mocked page test:
   - `apps/web/app/discover/__tests__/page.function-gate.test.ts`

## Implementation Notes

- Chose `/discover` instead of `/` because the root web route is the authenticated Today hub, while Discover already carries the module-browsing and launch-state messaging that matches this marketing block.
- The ring reads from the existing logo manifest under `apps/web/public/marketing/replace-ring/manifest.json`.
- The visual uses a single rotating orbit with a static MyLife center card, pause-on-hover behavior, and reduced-motion fallback.
- Mobile behavior is handled with responsive stacking and smaller chip sizing so the ring still fits inside the web shell.
- The page-level function-gate scaffold initially produced a generic placeholder test that imported `DiscoverPage` incorrectly and pulled in a React Native path. Replaced it with a real mocked page test that exercises enable flow, health-consent flow, and marketing-ring render coverage.

## Verification

- `pnpm --filter @mylife/web exec vitest run components/marketing/__tests__/ReplaceCompetitorRing.test.tsx components/marketing/__tests__/ReplaceCompetitorRing.function-gate.test.ts app/discover/__tests__/page.function-gate.test.ts`
  - 3 files passed, 9 tests passed.
- `pnpm --filter @mylife/web exec eslint app/discover/__tests__/page.function-gate.test.ts`
  - passed
- `pnpm gate:function --file apps/web/components/marketing/ReplaceCompetitorRing.tsx`
  - blocked by unrelated shared web typecheck errors in `modules/sleep`
- `pnpm gate:function --file apps/web/app/discover/page.tsx`
  - blocked by unrelated shared web typecheck errors in `modules/sleep`
- `pnpm gate:function:changed`
  - blocked by the existing unrelated mobile lint error in `apps/mobile/app/(notes)/discovery 2.tsx`

## Repo Blockers Encountered

- Shared web typecheck currently fails outside this change set with:
  - `modules/sleep/src/engine/morning-log.ts:132`
  - `modules/sleep/src/index.ts:67`
  - `modules/sleep/src/index.ts:68`
- Shared changed-function gate still fails on the known duplicate Notes route:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`

## Outcome

The new competitor ring is implemented, tested, and integrated into Discover. Remaining gate failures are repo-level blockers unrelated to this web marketing change.
