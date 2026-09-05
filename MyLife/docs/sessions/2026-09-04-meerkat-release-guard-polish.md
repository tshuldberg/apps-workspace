# Meerkat release guard and permission polish, 2026-09-04

## Scope and review

Reviewed the new production-readiness report against recent Meerkat mobile/web,
sync and relay history, Plan 40, Plan 59, and the implemented product boundaries.
The product spans private conversations, communities, shared libraries, calls,
creative spaces and a separate public layer. Creator commerce and mass-market
social features still have distinct implementation and evidence gaps. No product
capability was removed or declared release-ready.

Baseline: `7a40639d1e364ee384f92f0debbd036d995e7b4c`, existing branch
`fix/meerkat-orphan-watchdog`. The prior report and many documentation changes
were already uncommitted. During this session another writer began editing the
web persistence adapter, boot, provider, tests and UI. Those changes were
preserved and excluded from this session's implementation claims. One unused
helper created by this session was removed after detecting the overlap; the
attempted adapter rewrite failed before writing the file.

## Changes

- F3: store validation now resolves checked-in EAS profile inheritance and
  platform distribution instead of checking the literal `production` name.
  TestFlight is validated. Unknown/missing build profiles, cycles and excessive
  inheritance fail closed. Local and internal development profiles retain their
  existing skip behavior. The existing full capability requirements remain:
  no private-only runtime capability profile exists. Future custom EAS build
  workflows must explicitly invoke the guard.
- Production iOS now pins `macos-sequoia-15.6-xcode-26.0`, matching TestFlight.
  Commit `46bb6ccf` records failures on the prior default/latest toolchains and
  the reason for the established SDK 54 image. No new signed build was run.
- F9: both camera plugins now describe video calls and QR scanning. Microphone
  copy describes voice/video calls and audio rooms. Removed obsolete comments
  saying media functionality was future-only.
- Updated the pilot build guide, current report annotations and two historical
  task prompts so the old TestFlight bypass is no longer treated as current
  behavior.

## Product and test files

- `apps/meerkat/scripts/check-build-env.mjs`
- `apps/meerkat/scripts/__tests__/check-build-env.test.mjs`
- `apps/meerkat/scripts/__tests__/check-build-profiles.test.ts`
- `apps/meerkat/eas.json`
- `apps/meerkat/app.config.ts`
- `apps/meerkat/app.json`
- `apps/meerkat/app/__tests__/app-config.test.ts`

## Verification

All commands ran from `/Users/trey/Desktop/Apps/MyLife` unless stated otherwise.

- `pnpm gate:function --file apps/meerkat/scripts/check-build-env.mjs --tests scripts/__tests__/check-build-env.test.mjs,scripts/__tests__/check-build-profiles.test.ts,app/__tests__/app-config.test.ts`: PASS, full mobile lint, application/test TypeScript checks, 39 targeted tests.
- Regression control: empty iOS TestFlight configuration on baseline guard
  returned `ok:true`, `skipped:true`, zero errors. Fixed guard returns
  `ok:false`, `skipped:false`, 15 missing-configuration errors.
- `pnpm check:parity`: PASS, full repository suite.
- `pnpm check:generated-artifacts`: PASS.
- From `apps/meerkat`, `pnpm exec expo config --type introspect --json`: PASS.
  Generated Info.plist camera text: "Meerkat uses your camera for video calls
  and to scan QR codes." Microphone: "Meerkat uses your microphone for voice
  and video calls and audio rooms." Generated Android manifest contains
  CAMERA and RECORD_AUDIO permissions.
- `pnpm gate:function:changed`: final rerun PASS, mobile and web lint/typechecks
  and discovered related tests. First run caught TS2300 duplicate
  `BrowserDatabaseAdapter` imports during concurrent web edits; the other
  writer removed the duplicate before the successful rerun. This gate does not
  certify new untracked web tests or real-browser durability acceptance.
- Task-owned code whitespace checks: PASS.

Temporary raw output: `/tmp/meerkat-release-polish-20260904/`. Essential results
are recorded here because temporary logs are not durable evidence.

## Remaining

General availability remains NO-GO. This session does not certify the concurrent
F1/F2 storage implementation, real-browser recovery, fresh signed builds,
physical permission sheets, background delivery, provider/billing/safety drills,
or current remote release CI. Invitations, catch-up, settings, search and
performance remain prioritized follow-through areas from the current report.
TestFlight now needs real full-capability configuration; do not put placeholder
service addresses in environment variables to pass the guard. A narrower build
requires an explicit capability design with matching runtime behavior.

No commit, push, deployment, purchase, account change or external message was
performed.

## Primary implementation references

The EAS resolver applies platform overrides after inheritance and caps the
profile chain at five: [resolver source](https://raw.githubusercontent.com/expo/eas-cli/main/packages/eas-json/src/build/resolver.ts).
Distribution defaults to store: [schema source](https://raw.githubusercontent.com/expo/eas-cli/main/packages/eas-json/src/build/schema.ts).
Build variables and lifecycle timing: [environment documentation](https://docs.expo.dev/eas/environment-variables/usage/),
[build hook documentation](https://docs.expo.dev/build-reference/npm-hooks/).
