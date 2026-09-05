# 2026-04-16 — Hub routing and Settings back-button fixes

## Reported issues

User screenshots from iPhone 16e on iOS 26.2:

1. After signing in, the app opened directly into the MyBooks module home ("The Curator" header, books tab bar with Curator/Library/Search/Stats/Journal) instead of the hub dashboard.
2. MyBooks was not visible in module selection / discover.
3. On the Backup & Restore screen, the native "< settings" back button did not return the user to the Settings screen.

## Root causes

### Issue 1 — MyBooks lands as the cold-launch home

Every module route group (`(books)`, `(hub)`, `(mood)`, `(journal)`, etc.) contains its own `index.tsx`. Route groups are silent in the URL, so all of them compete to serve `/`. Expo Router's `unstable_settings.initialRouteName = '(hub)'` and the `Stack initialRouteName="(hub)"` JSX prop only control navigation-by-name within a Stack — neither disambiguates URL-to-file resolution. With no explicit root `app/index.tsx`, Expo Router's resolver landed on `(books)/index.tsx` (which is alphabetically first among the groups) for cold launches.

### Issue 2 — MyBooks not in module selection

`packages/module-registry/src/release-states.ts` had `books: 'hidden'` after commit `8ce9e9ba6` (Apr 7) tightened launch scope to 5 GA + 10 beta. `isUserVisibleModule()` filters hidden modules out of onboarding (`(onboarding)/index.tsx:213`), discover (`(hub)/discover.tsx:93`), and the hub library grid (`(hub)/index.tsx:297`).

### Issue 3 — Settings back button doesn't return to settings

The five sub-screens reachable from Settings (`backup`, `privacy`, `sharing`, `import-wizard`, `module-locks`) used the default Stack header with only a `title` set. Two compounding problems:

- The previous route (`settings`) uses `header: () => <HubHeader />` with no `title`, so the iOS native back button label fell back to the lowercase route name "settings".
- The five tab screens (`index`, `discover`, `search`, `data-sync`, `settings`) are all siblings in a single `(hub)` Stack, and the bottom tab bar transitions them via `router.navigate()`. That can fragment the stack history so `navigation.goBack()` is not guaranteed to pop back onto `settings`.

## Fixes

### `apps/mobile/app/index.tsx` (new)

Single-file root index that renders `<Redirect href="/(hub)" />`. Includes a long leading comment explaining the route-group ambiguity so a future maintainer doesn't delete it. This pins `/` to the hub dashboard for cold launches.

### `packages/module-registry/src/release-states.ts`

- `books` moved from `HIDDEN_MODULE_IDS` into `PUBLIC_BETA_MODULE_IDS`.
- `MODULE_RELEASE_STATES.books` flipped from `'hidden'` to `'public_beta'`.

Net result: 5 GA, 11 public beta, 14 hidden, 16 user-visible. Books appears in onboarding, discover, and the hub library grid again, badged BETA.

### `packages/module-registry/src/__tests__/release-states.test.ts`

Counts updated: PUBLIC_BETA 10 -> 11, HIDDEN 15 -> 14, USER_VISIBLE 15 -> 16. Replaced `isHiddenModule('books')` -> `isPublicBetaModule('books')` and `isUserVisibleModule('books') === false` -> `=== true`. Property tests untouched (no hardcoded counts).

### `apps/mobile/app/(hub)/_layout.tsx`

- New inline `BackToSettingsButton` component (lines 130-144): `Pressable` with `ChevronLeft` icon and "Settings" label. `onPress` calls `router.replace('/(hub)/settings')` for deterministic navigation regardless of stack state.
- Wired `headerLeft: () => <BackToSettingsButton />` onto the five sub-screens: `privacy`, `sharing`, `import-wizard`, `backup`, `module-locks` (lines 194-228).
- Added `styles.backToSettings` (row layout, 8px left padding, gap 2) and `styles.backToSettingsLabel` (16px medium weight, `colors.text`).
- `data-sync` intentionally not modified — it's both a main tab and a settings nav target, and it uses `header: HubHeader` so a `headerLeft` would be a no-op.

## HubUIUX audit

User asked whether the work for `/Users/trey/Downloads/HubUIUX` (the Stitch/Loom design downloads) had been done. Verified yes:

| HubUIUX folder | Prompt doc | Hub screen | Lines |
|---|---|---|---|
| `loom_dashboard` | `hub-dashboard.md` | `(hub)/index.tsx` | 660 |
| `discover_modules` | `hub-discover.md` | `(hub)/discover.tsx` | 384 |
| `loom_search` | `hub-search.md` | `(hub)/search.tsx` | 516 |
| `loom_onboarding` | `hub-onboarding.md` | `(onboarding)/index.tsx` | 1045 |
| `hub_settings` | `hub-settings.md` | `(hub)/settings.tsx` | 574 |
| `backup_restore` | `hub-backup-restore.md` | `(hub)/backup.tsx` | 599 |
| `data_sync` | `hub-data-sync.md` | `(hub)/data-sync.tsx` | 501 |
| `import_wizard` | `hub-import-wizard.md` | `(hub)/import-wizard.tsx` | 802 |
| `privacy_dashboard` | `hub-privacy-dashboard.md` | `(hub)/privacy.tsx` | 776 |
| `sharing_preferences` | `hub-sharing-preferences.md` | `(hub)/sharing.tsx` | 599 |
| `obsidian_noir` | (design system doc) | `packages/ui/src/tokens/` | n/a |

Intentional deviations (per `docs/uiux-prompts/hub-redesign-reference.md:32-37`): wordmark is "MyLife" not "Loom", font is Inter not Plus Jakarta Sans, icons are Lucide not Material Symbols. Reference doc explicitly says to keep Inter and Lucide.

The hub dashboard's `hub-dashboard.md:89-93` spec calls for "CARD 1 — MyBooks" as the first bento card. That layout was silently broken because books was hidden. Unhiding books restores the spec'd intent.

## Verification

Local repo could not run tests — `apps/mobile/node_modules` missing both `tsc` and `vitest` binaries (the noisy apps/mobile infra issue documented in `memory.md:9`). The PostToolUse typecheck hook fired errors that pre-existed the edits (e.g. `react-native` type resolution, `react/jsx-runtime` missing) on files unrelated to this work.

After `pnpm install` in a clean tree, the user should run:
- `pnpm --filter @mylife/module-registry test` — confirms updated counts
- `pnpm gate:function:changed` — function gate
- `pnpm check:parity` — parity suite (already invoked by the TaskCompleted hook)

After rebuilding the mobile app:
- Cold launch should land on the hub dashboard, not The Curator
- MyBooks should appear in Discover under Lifestyle with a BETA badge
- The hub bento grid restores MyBooks as the first card
- Tapping "< Settings" on Backup & Restore (and the other four sub-screens) returns reliably to the Settings screen

## Files changed

- `apps/mobile/app/index.tsx` (new)
- `apps/mobile/app/(hub)/_layout.tsx`
- `packages/module-registry/src/release-states.ts`
- `packages/module-registry/src/__tests__/release-states.test.ts`
- `memory.md`
- `docs/sessions/2026-04-16-hub-routing-and-settings-back-button.md` (this file)

## Patterns for future maintainers

- **Multiple `(group)/index.tsx` siblings need an explicit root `app/index.tsx`.** `unstable_settings.initialRouteName` is a Stack hint, not a URL resolver. With many silent route groups all claiming `/`, only an explicit root index file can pin the URL deterministically. Use a `<Redirect>` to keep it one line.
- **Release-state visibility is a single hidden lever.** `isUserVisibleModule()` is the choke point for onboarding, discover, and the hub dashboard. Flipping a module to `'hidden'` silently breaks any design spec that depends on it being visible (e.g. the hub bento "CARD 1 - MyBooks" spec).
- **Stack siblings with `router.navigate()` tab transitions can fragment history.** When a Stack hosts both "tab" screens (mutually exclusive top-level destinations) and pushed sub-screens, `navigation.goBack()` from a sub-screen is not reliably the inverse of the navigate that brought you to its parent. Prefer explicit `router.replace('/(parent)/settings')` headerLeft buttons over relying on goBack for sub-screens.
