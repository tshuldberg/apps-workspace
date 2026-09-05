# 2026-04-04 MySurf + MyTrails redesign

Task `4.11.g` from `.kiro/specs/production-release-readiness/tasks.md`.

## Scope

- Redesign MySurf and MyTrails hub surfaces to match `docs/uiux-prompts/mysurf.md` and `docs/uiux-prompts/mytrails.md`.
- Apply accents `#3B82F6` for surf and `#65A30D` for trails.
- Preserve existing surf session logging and trail tracking behavior.

## What changed

### MySurf mobile

- Added a shared surf shell in `apps/mobile/app/(surf)/_ui.tsx`.
- Reworked the tab layout to `Home`, `Map`, `Spots`, `Sessions`, `Settings`.
- Redesigned:
  - `apps/mobile/app/(surf)/index.tsx`
  - `apps/mobile/app/(surf)/map.tsx`
  - `apps/mobile/app/(surf)/sessions.tsx`
- Added prompt-aligned routes:
  - `apps/mobile/app/(surf)/spots.tsx`
  - `apps/mobile/app/(surf)/settings.tsx`
- Kept `apps/mobile/app/(surf)/account.tsx` as a re-export alias into settings so existing account tests still pass.

### MySurf web

- Added a shared surf desktop shell and primitives:
  - `apps/web/app/surf/ui.tsx`
  - `apps/web/app/surf/layout.tsx`
- Replaced the broken standalone passthrough dependency with local hub pages for:
  - `apps/web/app/surf/map/page.tsx`
  - `apps/web/app/surf/favorites/page.tsx`
  - `apps/web/app/surf/sessions/page.tsx`
  - `apps/web/app/surf/account/page.tsx`
  - `apps/web/app/surf/spot/[slug]/page.tsx`
- Redesigned the explorer home:
  - `apps/web/app/surf/page.tsx`
- Added prompt-aligned desktop routes:
  - `apps/web/app/surf/forecast/page.tsx`
  - `apps/web/app/surf/swell/page.tsx`
  - `apps/web/app/surf/tides/page.tsx`
  - `apps/web/app/surf/alerts/page.tsx`
  - `apps/web/app/surf/crew/page.tsx`
  - `apps/web/app/surf/ratings/page.tsx`

### MyTrails mobile

- Added a shared trails shell in `apps/mobile/app/(trails)/_ui.tsx`.
- Reworked the tab layout to `Home`, `Trails`, `Record`, `Packing`, `Settings`.
- Redesigned:
  - `apps/mobile/app/(trails)/index.tsx`
  - `apps/mobile/app/(trails)/settings.tsx`
- Added prompt-aligned routes:
  - `apps/mobile/app/(trails)/record.tsx`
  - `apps/mobile/app/(trails)/gear.tsx`
  - `apps/mobile/app/(trails)/weather.tsx`
  - `apps/mobile/app/(trails)/segments.tsx`
  - `apps/mobile/app/(trails)/reviews.tsx`
  - `apps/mobile/app/(trails)/export.tsx`

### MyTrails web

- Added a shared trails desktop shell:
  - `apps/web/app/trails/shell.tsx`
  - `apps/web/app/trails/layout.tsx`
- Rebuilt the explorer home:
  - `apps/web/app/trails/page.tsx`
- Added prompt-aligned desktop routes:
  - `apps/web/app/trails/gear/page.tsx`
  - `apps/web/app/trails/routes/page.tsx`
  - `apps/web/app/trails/weather/page.tsx`
  - `apps/web/app/trails/segments/page.tsx`
  - `apps/web/app/trails/photos/page.tsx`
  - `apps/web/app/trails/settings/page.tsx`

## Notes

- The prompt docs are internally inconsistent on exact screen totals. I followed the named prompt surfaces plus existing hub routes, which matches the earlier Flash/Stars redesign approach already documented in memory.
- The surf web passthrough routes were pointing at missing standalone paths. Local hub implementations now replace those broken wrappers directly.
- `pnpm gate:function:changed` still fans out into a large unrelated dirty-worktree change set and fails on existing duplicate `* 2.tsx` files plus pre-existing mobile warnings/typecheck errors. During that run it surfaced one real bug from this session, and `apps/mobile/app/(trails)/weather.tsx` was fixed to treat recent conditions as `string[]`.

## Verification

- `pnpm --filter @mylife/mobile exec eslint "app/(surf)/_layout.tsx" "app/(surf)/_ui.tsx" "app/(surf)/index.tsx" "app/(surf)/map.tsx" "app/(surf)/sessions.tsx" "app/(surf)/spots.tsx" "app/(surf)/settings.tsx" "app/(surf)/account.tsx"`
- `pnpm --filter @mylife/mobile exec vitest run "app/(surf)/__tests__/index.test.tsx" "app/(surf)/__tests__/map.test.tsx" "app/(surf)/__tests__/sessions.test.tsx" "app/(surf)/__tests__/favorites.test.tsx" "app/(surf)/__tests__/account.test.tsx"`
- `pnpm --filter @mylife/mobile exec eslint "app/(trails)/_layout.tsx" "app/(trails)/_ui.tsx" "app/(trails)/index.tsx" "app/(trails)/settings.tsx" "app/(trails)/record.tsx" "app/(trails)/gear.tsx" "app/(trails)/weather.tsx" "app/(trails)/segments.tsx" "app/(trails)/reviews.tsx" "app/(trails)/export.tsx"`
- `pnpm --filter @mylife/web exec eslint "app/surf/**/*.tsx" "app/surf/**/*.ts" "app/trails/**/*.tsx" "app/trails/**/*.ts"`
- `pnpm --filter @mylife/web exec tsc --noEmit --pretty false`
- `pnpm gate:function:changed` (fails on unrelated pre-existing dirty-worktree mobile warnings/typecheck errors; see notes above)
