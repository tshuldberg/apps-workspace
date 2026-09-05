# 2026-08-02 - Meerkat TestFlight prep: icon, call-native plugin, share envelopes

## What was done

1. **App icon wired** from the founder's supplied art (dark navy eye + M mark, 1254px, alpha-free): generated `apps/meerkat/assets/{icon,adaptive-icon,splash-icon}.png` via sharp (iOS 1024 no-alpha; Android full-bleed foreground, launcher masks crop the baked corners; 512 splash mark). Referenced in `app.json` (icon, splash image + `#F6F4EF` bg, adaptiveIcon foreground + `#000000` bg). **Gitignore fix required:** the root `*.png` rule silently ignored `apps/meerkat/assets/` (same defect class as the July iCloud-sources loss); added `!apps/meerkat/assets/` + `!apps/meerkat/assets/*.png` exceptions. Without this EAS archives would exclude the icon.
2. **`@mylife/meerkat-call-native` config plugin** added to `app.config.ts` plugins (was imported at runtime by CallProvider but its plugin never ran, so `voip` background mode / `MANAGE_OWN_CALLS` were missing).
3. **Share envelopes feature** (founder request: easy iMessage sharing of communities/contacts to people new to Meerkat). Raw `meerkat://` links and `MEER-` codes mean nothing to a person without the app; every share surface now wraps them in a ready-to-text message with install + exact paste steps:
   - Pure core `invite-envelope-core.ts` as byte-identical mobile/web twins (`apps/meerkat/app/(root)/data/`, `apps/meerkat-web/src/lib/`), parity-locked below the `CommunityInviteEnvelopeArgs` anchor in `check-meerkat-parity.mjs`, plus ensureContains locks that all four share surfaces route through the builders.
   - Honesty rules held: install step OMITTED entirely when no install URL configured (never a placeholder), join wording matches the parity-locked in-app copy ("Join with an invite"), contact envelope names the publish dependency instead of promising resolution, no delivery/presence claims.
   - New config: `MEERKAT_INSTALL_URL` -> `extra.installUrl` (mobile, expo-constants pattern) and `VITE_MEERKAT_INSTALL_URL` (web) via new `install-url.ts` readers. Founder sets these to the TestFlight public link.
   - UI: mobile InviteShareSheet "Share invite" now shares the envelope (Copy still hands over the raw link) + hint line; mobile add-friend gains "Share my contact" (native share sheet); web CommunitySettings invite panel gains "Copy invite message"; web AddFriendOverlay gains "Copy contact message".
   - Also declared the previously-missing `VITE_MEERKAT_ACCOUNT_SERVICE_URL` + new `VITE_MEERKAT_INSTALL_URL` in `vite-env.d.ts` (closing a gap found in the 08-01 review).
4. Walkthrough updated: repo-fix rows 1 and 3 marked done, `MEERKAT_INSTALL_URL` added to the env appendix.

## What was deliberately NOT done

- **Universal https links** (tappable in iMessage, App Store fallback): require a domain serving `apple-app-site-association` + an `associatedDomains` entitlement change. Deferred as founder-ops; touching the entitlement set right before the first green build would risk the credentials fix. The envelope is the full-function answer available with current infra.
- eas.json `env`/`submit` blocks: still need founder values (RevenueCat `appl_` key, relay URL, ascAppId).

## Verification

- Envelope tests: 9 mobile + 9 web, all passing (incl. install-step omission renumbering, publish-dependency line, no-claims checks).
- Full suites on the merged work: meerkat-app 1502/1502, meerkat-web 1049/1049.
- `check-meerkat-parity.mjs`: all checks pass including the new twin + surface locks.
- Typecheck clean both packages; `expo config --type prebuild` resolves (icon set, call-native plugin present, installUrl in extra).
- Function gate runs on staged changes via pre-commit.

## Files changed

`apps/meerkat/assets/*` (new), `apps/meerkat/app.json`, `apps/meerkat/app.config.ts`, `.gitignore`, `apps/meerkat/app/(root)/data/{invite-envelope-core,install-url}.ts` (new), `apps/meerkat/app/(root)/components/InviteShareSheet.tsx`, `apps/meerkat/app/(root)/(tabs)/add-friend.tsx`, `apps/meerkat/app/__tests__/invite-envelope-core.test.ts` (new), `apps/meerkat-web/src/lib/{invite-envelope-core,install-url}.ts` (new), `apps/meerkat-web/src/lib/__tests__/invite-envelope-core.test.ts` (new), `apps/meerkat-web/src/ui/community/CommunitySettings.tsx`, `apps/meerkat-web/src/ui/friends/AddFriendOverlay.tsx`, `apps/meerkat-web/src/vite-env.d.ts`, `scripts/check-meerkat-parity.mjs`, walkthrough HTML, `memory.md`.

## Addendum: first green iOS build (2026-08-02, build 06cc1435)

Five-build burn-down, each failure a distinct real defect, all logs pulled via the EAS GraphQL logFiles API (brotli):

1. 66c72eef (founder interactive): stored provisioning profile lacked Push capability; the interactive run regenerated it.
2. Founder's rerun (image "latest" = Xcode 26.6): fmt consteval clang errors. Fix: pin image.
3. 463f30c2 (image "default" = Xcode 15.4): RN 0.81.5 requires Xcode >= 16.1, pod install refused. Fix: pin the SDK-54-blessed macos-sequoia-15.6-xcode-26.0.
4. 00705b96 (xcode-26.0): Module 'MapLibre' not found: @maplibre/maplibre-react-native config plugin was never applied. Fix: one plugin line.
5. 6a3690ba + 70973f4b: first real compile of the owned Swift exposed an illegal Exception-subclass pattern (stored `code` shadowing `open var code: String`, get-only `name` override vs settable lazy var) copy-pasted across MeerkatCallKitModule, MeerkatBleWakeModule, MeerkatNearbyModule (iCloud module alone was correct). Fixed with the errorCode pattern.
6. 06cc1435: FINISHED. First successful Meerkat iOS build; all owned native modules (CallKit, BLE wake, Nearby/Multipeer) compiled on a store-signed lane.

Ledger note: the rc17 "both native transport files have NEVER been compiled" statement is now stale (compiled in 06cc1435); AC-1/AC-3 device-run rows remain OPEN per the do-not-close-from-unit-tests rule.

This binary has NO EXPO_PUBLIC_MEERKAT_RC_KEY_IOS / MEERKAT_DEFAULT_RELAY_URL baked: it installs and boots but stays honestly locked past public surfaces. The tester-usable build needs those two env values + one rebuild (fast now).
