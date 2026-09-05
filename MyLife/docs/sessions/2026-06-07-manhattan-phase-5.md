# Manhattan Phase 5 (Cloud + Lock + Monetization seams) (2026-06-07)

## What was done

Built the codeable seams of Phase 5 (plan `docs/plans/manhattan-mission-control.html`, cards P5-A/B/C; design section 10 + 13). Per user direction, this phase delivers the in-repo seams only; the operational release work (eas init/projectId, real builds, RevenueCat/Stripe products, Supabase project provisioning, two-device mesh-sync verification, device QA, and the promote-from-hidden flip) is deferred to an operational checklist. Manhattan stays HIDDEN.

## Code shipped

Module (`modules/manhattan/src`):
- `cloud/client.ts`: `initManhattanClient` / `getManhattanClient` / `resetManhattanClient` / `hasManhattanClient` (singleton, mirrors BestChef). Added `@supabase/supabase-js` dep.
- `integrations/social-bridge.ts`: pure `buildPlanShareInput` (+ `ManhattanPlanShareInput`), decoupled from `@mylife/social`.
- `index.ts`: barrel exports for both.

Shared packages:
- `@mylife/auth`: added `manhattan` to `LOCKABLE_MODULE_IDS` (now 9) + updated the constants test.
- `@mylife/social`: added `manhattan_event_saved` / `manhattan_plan_shared` activity types, `manhattan` in `SOCIAL_CAPABLE_MODULES`, `manhattan_plan` ShareCardType, `generateManhattanPlanCard`, `emitManhattanEventSaved` / `emitManhattanPlanShared`, exports + tests.

App (`apps/manhattan`):
- Deps: `@mylife/entitlements`, `@mylife/billing-config` (workspace), `expo-local-authentication ~17.0.8`.
- `providers/ManhattanCloudProvider.tsx` + `data/launch-environment.ts`: env-gated Supabase client (built only when `EXPO_PUBLIC_MANHATTAN_SUPABASE_URL` + `_ANON_KEY` exist), `initManhattanClient` on configured / reset otherwise; `useManhattanCloud`. No-login default preserved (client null when unconfigured).
- `components/ManhattanLockGuard.tsx`: optional PIN/biometric lock via `@mylife/auth` (`getModuleLock`/`attemptUnlock`); no lock configured -> passes through; locks on cold start.
- `components/UnlockGate.tsx`: `$4.99` paywall gate via `isModuleUnlocked('manhattan', ...)`; entitlements test mode (default on) passes through in dev; purchase noted as App Store / operational; comment flags `setTestMode(false)` before release.
- `settings/data-sync.tsx`: cloud status, app-lock enable/disable (confirmed PIN), entitlement status. Linked from the Settings tab.
- `_layout.tsx`: provider order `DatabaseProvider > AppThemeProvider > ManhattanCloudProvider > ShareIntentWatcher > UnlockGate > ManhattanLockGuard > OnboardingGate > Stack`; `settings/data-sync` modal screen.

## Verification

- `pnpm --filter @mylife/manhattan typecheck` + `test`: 25 files, 208 passed.
- `@mylife/social` typecheck + 15 tests; `@mylife/auth` lock unit 40/40 (the auth property test has pre-existing PBKDF2-timeout flakiness, unrelated, verified on a clean baseline).
- `pnpm --filter @mylife/manhattan-app typecheck`: clean. `pnpm exec expo export -p ios`: clean (3468 modules, 7.5 MB bundle).
- `pnpm check:passthrough-parity`: 114 passed, 4 skipped.
- Adversarial review (4 parallel agents).

## Review findings and fixes

- The review's headline "critical" (social functions missing, 4 tests failing) was a FALSE POSITIVE: an agent read a pre-install state. Verified directly: the functions exist, are exported, and `@mylife/social` passes 15/15. Dismissed.
- Fixed: `UnlockGate` froze the entitlement/test-mode check in a `useMemo([])` (stale snapshot) -> compute directly each render.
- Fixed: `ManhattanLockGuard` final `else` unlocked on any unexpected status -> now only the explicit `not_configured` status passes through.
- Fixed: `data-sync` enable-lock wrapped in try/catch (surfaces a DB failure instead of a silent success).
- Fixed: removed the unused `@mylife/social` app dependency; flattened the `ManhattanCloudProvider` config memo.
- Assessed and declined: the "lock guard captures state at mount" finding. The guard sits at the app root and locks on cold start (standard pattern); the described disable-trap cannot occur (reaching settings to disable requires being unlocked already). `data-sync` reflects/toggles lock state correctly via `useFocusEffect`.

## Decisions and caveats

- The `NotificationPlatformOps` precedent applies again here: the hub's lock/entitlements UIs live in `apps/mobile`, not shared packages, so Manhattan ships compact app-level lock + paywall gates rather than porting the full hub provider. Test mode (default on) keeps the app usable in dev; the real purchase + entitlement state are operational.
- Cloud/lock/paywall are bundle-verified only (no simulator/infra). Real Supabase sync, PIN/biometric, and purchases need an EAS dev build + provisioned infra.

## Remaining (operational, user-side)

- `eas init` + `extra.eas.projectId`; production EAS build + TestFlight submit.
- Provision a Supabase project + set `EXPO_PUBLIC_MANHATTAN_SUPABASE_*`; verify two-device mesh sync respects pins `maxScope`.
- RevenueCat (mobile) / Stripe (web) products for `mylife_manhattan_unlock`; set entitlements `setTestMode(false)` for release.
- A UIUX mission-control doc, then promote `manhattan` out of `HIDDEN_MODULE_IDS`.
- Optional: wire `@mylife/social` share UI into the app (emit/generate are ready); rich MyNotes notes; hub (apps/mobile + apps/web) wiring of the cross-module + bridges.
- The `@mylife/friends` rsvp-link/music-link stubs remain blocked (P4 note).
