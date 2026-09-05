# 2026-04-16 — Web build fix via `.native.ts` split

## Context

Teammate on Windows 11 / PC reported `pnpm dev:web` failing on fresh clone with HTTP 500 on every route. Turbopack error overlay: `Unknown module type` on ~25 `.ttf` icon-font files from `@expo/vector-icons`. Separately, `pnpm --filter @mylife/web build` failed with `Module parse failed: Unexpected token` on `expo-image`'s raw TypeScript.

Root cause documented in the teammate's report at `/Users/trey/Downloads/mylife-web-build-report.md`:

- 8 module `src/index.ts` files had `export * from './ui'`.
- Those module `./ui/index.ts` files re-exported RN components (`MaterialSymbol`, `AddFAB`, `GlassCard`, ...) that import `@expo/vector-icons`, `react-native`, `expo-linear-gradient`.
- The web app's `apps/web/components/Providers.tsx` imports `BUDGET_MODULE` / `BOOKS_MODULE` etc. from those barrels purely for metadata.
- Turbopack and webpack walk the full re-export graph, land on `.ttf` imports inside `@expo/vector-icons`, and fail because there's no registered loader.

Secondary issue: `expo-image` (and most `@mylife/*` and `expo-*` packages) were missing from `transpilePackages`, so `next build` tried to pass raw TypeScript through webpack's default JS parser and failed.

## What shipped

**Architecture decision:** Use Metro's built-in platform file resolution (`.native.ts`) instead of splitting mobile imports across a new `@mylife/<module>/ui` subpath. `packages/sync` already uses this pattern. Result: zero mobile import churn, clean web separation.

### Per-module changes (8 modules: budget, garden, habits, market, nutrition, presence, stars, trails)

1. `src/ui/index.native.ts` (new): full RN component surface — exactly what `src/ui/index.ts` contained before the split. Metro picks this on iOS/Android.
2. `src/ui/index.ts` (overwritten): web-safe barrel. Re-exports `./tokens` + `./typography` only, plus `./logic` for modules that have web-safe pure helpers (market, presence). Webpack/Turbopack ignores `.native.ts` and reads this.
3. `src/index.ts`: reverted to `export * from './ui'` (unchanged from pre-session state).
4. `package.json`: `./ui` subpath upgraded to conditional export:
   ```json
   "./ui": {
     "react-native": "./src/ui/index.native.ts",
     "default": "./src/ui/index.ts"
   }
   ```

### Mobile tsconfig

`apps/mobile/tsconfig.json` — added two compiler options so `tsc --noEmit` matches Metro's platform resolution:
- `moduleSuffixes: [".native", ""]` — picks `<file>.native.ts` before `<file>.ts` for internal paths (handles the `export * from './ui'` case).
- `customConditions: ["react-native"]` — picks the `"react-native"` condition from `exports` fields when resolving `@mylife/<module>/ui`.

### Web next.config

`apps/web/next.config.ts` — defense in depth even with barrel fix in place:
- `transpilePackages` expanded from 25 entries to ~50: all 30 `@mylife/*` modules + all hub packages + `expo-*` + `react-native-*` + `lucide-react-native`. Fixes the `expo-image` secondary failure.
- `turbopack.rules`: `.ttf` / `.otf` / `.woff` / `.woff2` routed to a stub loader (`apps/web/lib/turbopack/empty-module.js`) that returns an empty module. Same treatment added to the webpack config for prod-build parity.

### Mobile import fixes (2 files)

- `apps/mobile/app/(mood)/log-mood.tsx`: `from '@mylife/mood/src/ui'` → `from '@mylife/mood/ui'` (the `/src/ui` path bypassed the exports field; now it goes through conditional resolution).
- `modules/presence/src/data/app-library.ts`: `import type { PresenceMaterialSymbolName } from '../ui'` → `from '../ui/components/MaterialSymbol'`. The type-only import went through the web-safe barrel, which doesn't export RN-side types; pointing at the source file skips the barrel.

### Also modified

- `modules/health/package.json`, `modules/mood/package.json`, `modules/budget/package.json`: added `exports` field with `./ui` subpath for parity with the other modules.

## Verification

- Mobile `tsc --noEmit`: clean (0 errors).
- Web `tsc --noEmit` + Next.js `typegen`: clean (0 errors).
- Module tests across 5 touched modules: 1,176 passing (budget 373, habits 316, trails 250, stars 128, market 109).
- All 8 modified modules: 0 typecheck errors individually.

## What NOT to do going forward

- Do NOT add new RN components to `./ui/index.ts` (the web-safe barrel). Put them in `./ui/index.native.ts` only.
- Do NOT `export * from './ui/<some-rn-component>'` from `src/index.ts`. Use `export * from './ui'` and let platform resolution handle it.
- Do NOT mix web-safe helpers and RN components in the same file. Keep `tokens.ts` / `typography.ts` / `logic.ts` pure. Keep `components/*.tsx` RN-only.
- Mobile imports of tokens and types continue to work unchanged because the full native barrel re-exports everything the web barrel has plus the RN surface.

## Follow-ups

- None required for beta testing. Teammate can now `pnpm install && pnpm dev:web` on a fresh clone. The equivalent fix applies to `pnpm --filter @mylife/web build`.
- When a new module is added, copy the budget pattern: `./ui/index.ts` web-safe, `./ui/index.native.ts` full, conditional `./ui` export in package.json.
- Consider adding a CI check that greps for RN imports under `./ui/index.ts` (not `.native.ts`) — a future regression would reintroduce the bug silently.

## Files changed

- `apps/mobile/tsconfig.json`, `apps/mobile/app/(mood)/log-mood.tsx`
- `apps/web/next.config.ts`, `apps/web/lib/turbopack/empty-module.js` (new)
- `modules/{budget,garden,habits,market,nutrition,presence,stars,trails}/src/index.ts`
- `modules/{budget,garden,habits,market,nutrition,presence,stars,trails}/src/ui/index.ts`
- `modules/{budget,garden,habits,market,nutrition,presence,stars,trails}/src/ui/index.native.ts` (new)
- `modules/{budget,garden,habits,health,market,mood,nutrition,presence,stars,trails}/package.json`
- `modules/presence/src/data/app-library.ts`
