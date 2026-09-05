# Hub Shell Validation Pass - 2026-04-07

## Goal

Validate every shell screen and button in the mobile hub shell so testers
land on a working build. Static analysis only -- minimal patches, no
refactors, no feature work.

## Scope

Files in scope:
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(hub)/**`
- `apps/mobile/app/(auth)/**`
- `apps/mobile/app/(onboarding)/**`
- `apps/mobile/app/(social)/**`
- `apps/mobile/components/**`
- `packages/module-registry/**` (bug fixes only)
- `packages/ui/**` (bug fixes only)

Out of scope: every `modules/<name>/` and per-module `app/(<module>)/`
directory. Cluster agents own those.

## Routes Inspected

Hub: `index`, `discover`, `search`, `data-sync`, `settings`, `privacy`,
`sharing`, `import-wizard`, `backup`, `module-locks`, `onboarding-privacy`,
`onboarding-mode`, `self-host`, `_layout`.

Auth: `_layout`, `sign-in`, `sign-up`.

Onboarding: `_layout`, `index` (8 in-screen steps).

Social: `_layout`, `feed`, `discover`, `profile`.

Root: `_layout` (registry/database/auth/entitlement provider stack).

Total shell route count: 23 screen files plus the four `_layout.tsx`
group layouts.

## Bugs Found and Fixed

1. `(presence)` group missing from the root Stack.Screen list in
   `apps/mobile/app/_layout.tsx`. The presence module is in
   `USER_VISIBLE_MODULE_IDS` (public_beta), is registered in the
   ModuleRegistry, has migrations wired in DatabaseProvider, and has a
   route group at `app/(presence)/`. Adding the explicit Stack.Screen
   keeps the root stack consistent with the dashboard navigation target
   and matches the convention used for every other visible group.

2. `presence` missing from `MODULE_ICONS` in
   `packages/module-registry/src/hub-icons.ts`. The dashboard module
   grid item lookup falls back to the literal string `circle` when no
   icon is mapped, which is a real Lucide name so it does not crash but
   does ship a wrong icon. Added `presence: 'smartphone'` so the
   dashboard, discover, and search screens render the correct glyph.

## Cross-Module Issues Observed (Not Fixed - Cluster Owned)

1. `apps/mobile/app/(hub)/__tests__/dashboard.test.tsx` and
   `settings.test.tsx` are stale relative to current
   `release-states.ts` (books and fast are now hidden) and current
   settings UI (no "Change Mode" button -- it became a segmented
   control). These pre-date the release-state shrink. Test owner should
   refresh fixtures.

2. `apps/mobile/components/ModuleLocksScreen` indexes
   `colors.modules[moduleId]` for every entry in `LOCKABLE_MODULE_IDS`.
   All current lockable ids exist in the ui token map, but if a future
   lockable id is added without a token entry the Switch trackColor
   prop will be undefined. Not blocking.

3. The `(subs)` route group still ships with screens but the subs
   module is hidden in release-states. The dashboard never routes
   there. This is a hidden module group, not a shell bug, but worth
   logging.

4. The mobile vitest workspace pool hangs for several test files (sat
   on `lib/workouts/__tests__/settings.test.ts` then never advanced).
   Pre-existing infrastructure problem, not introduced this session.
   Did not edit any test files.

## Commits

- `fix(hub-shell): register (presence) group and add presence icon`

## Verification

- `pnpm --filter @mylife/mobile typecheck` PASS (clean)
- `pnpm --filter @mylife/module-registry typecheck` PASS (clean)
- `pnpm --filter @mylife/module-registry test` PASS (52/52)
- `pnpm --filter @mylife/mobile lint` 0 errors, 124 pre-existing warnings
- `pnpm --filter @mylife/db typecheck` PASS (clean)
- `pnpm --filter @mylife/ui typecheck` PASS (clean)
- `pnpm gate:function:changed --staged` typecheck phase PASS, mobile
  vitest pool deadlocks (pre-existing infra issue, not from this diff)

## Final Verdict per Shell Area

- Hub dashboard: GREEN
- Hub discover, search, settings, data-sync, privacy, sharing, backup,
  import-wizard, module-locks, self-host, onboarding-mode,
  onboarding-privacy: GREEN
- Auth (sign-in, sign-up): GREEN
- Onboarding (8 steps): GREEN
- Social (feed, discover, profile): GREEN
- Root layout / providers / registry: GREEN

## Notes

The DatabaseProvider preference-based bootstrap that was uncommitted at
session start has since been committed by a parallel cluster agent
(commit 0976cd7ff "Adjust hub release visibility and shared infra"),
along with the release-states reshuffle. Nothing in this session
touched that file.
