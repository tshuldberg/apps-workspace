# 2026-07-11 react-native Dedup (W8 follow-up)

Branch `fix/rn-wildcard-peer-pin-2026-07-11` (off local main `f0114a6e`). Executes the fix recommended by the W8 debt investigation ([findings](2026-07-11-repo-hygiene-w8.md)).

## Problem

pnpm-lock.yaml resolved react-native to both 0.81.5 (all apps, Expo SDK 54) and 0.84.1 (several hub modules), risking type and native-runtime drift between modules and the apps that host them.

## Root causes (three, found iteratively)

1. 20 modules under `modules/` declared `"react-native": "*"` peers; autoInstallPeers resolved the wildcard to 0.84.1. Fixed by pinning `~0.81.5` (matching apps) in commit `36731abe`.
2. `packages/meerkat-native-transport` (new on main via the Plan 42 merge) declared wildcard `expo`/`react-native` optional peers; pinned to `~54.0.33` / `~0.81.5`.
3. 18 modules devDepended on deprecated `@types/react-native@0.72`; its transitive `@react-native/virtualized-lists@0.72.8` peer-resolved react-native to 0.84.1. RN ships its own types since 0.71, so the package was removed outright.

Also added `"react-native": "~0.81.5"` to root `pnpm.overrides` (alongside the existing react/@types/react overrides) as defense in depth against future transitive peers.

## Honest residual

Inert `react-native@0.84.1` peer-context snapshots remain in the lockfile: pnpm overrides do not rewrite peerDependency ranges, so optional peer contexts (drizzle-orm's `expo-sqlite` peer reached through `modules/homes`, and `@react-native/metro-config@0.84.1` optional-peer keys) still reference 0.84.1. `pnpm why -r react-native` finds ZERO consumers of 0.84.1; every workspace importer resolves 0.81.5, verified in the importers section of the lockfile and by resolving `react-native/package.json` from previously-mismatched modules. Force-eliminating the ghost contexts would mean pinning optional peers of third-party tooling (Expo metro config), with breakage risk and no runtime benefit. Accepted as cosmetic.

## Verification

- Lockfile importers: all `react-native:` entries resolve `0.81.5`.
- `modules/{bestchef,workouts,nutrition}` resolve react-native 0.81.5 on disk.
- Typecheck green: bestchef, workouts, cycle, garden, health, meds, mood, nutrition, homes, meerkat-native-transport, mobile.
- Tests green: workouts 677/677, bestchef 1304 passed + 1 pre-existing skip.

## Commits

- `36731abe` fix(deps): pin react-native peer range in hub modules to ~0.81.5 (agent-authored, lead-verified)
- `aa17851e` fix(deps): complete react-native dedup - drop @types/react-native, add root override
