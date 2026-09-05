# 2026-08-01: Meerkat TestFlight track + friend onboarding guide

## Goal

Founder wants Meerkat testable by himself + one non-technical friend on both the mobile app (TestFlight) and the web browser experience, with the phone app as the data home (iPhone-app-as-hub end state), and an HTML step-by-step guide for the friend.

## TestFlight track: what was found and done

- `apps/meerkat` already has a full EAS setup: `eas.json` (production profile, autoIncrement, remote versions), project `c662e59e-1950-4b9e-ae0e-262bc3bbfdf1`, owner `trebaybay`, bundle `com.mylife.meerkat` (+ `com.mylife.meerkat.share-extension`).
- A 07-01 production iOS build (12f4d4fe, commit 100b297c) ERRORED in the Bundle JavaScript phase. Reproduced the same step locally on today's tree: `npx expo export --platform ios` SUCCEEDS (14.9 MB hbc bundle), so that failure is stale.
- Apple credentials are fully provisioned on EAS: distribution cert + provisioning profile active until 2027-03-26, team 4LMG5HM5UV (Trey Shuldberg Individual). No credential work needed.
- Launched a fresh validation build: `eas build --profile production --platform ios --non-interactive --no-wait` from main `550c795f` = build `f21cdeb0-ce7c-4ff2-a831-9dd05e679488`. This is the first EAS compile of the plan 42/53 owned native transport module (Swift/Kotlin previously unverified). Watcher logs to the session scratchpad.
- Unlock gate ground truth (matters for TestFlight usefulness): without `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` baked at build time, `app-unlock.ts` reports the IAP unavailable and the gate stays LOCKED fail-closed (public browsing only). A tester-usable TestFlight build therefore needs RevenueCat iOS key + the ASC non-consumable `meerkat_app_unlock` to exist first (launch guide Step 6). TestFlight purchases run in Apple sandbox, testers pay nothing.

## Founder path to TestFlight (in order)

1. Fix GitHub billing (separate blocker, unrelated to EAS but blocks the rc train).
2. If build f21cdeb0 compiles green, the native tree is EAS-proven. If it errors, the log names the module; fix and rebuild.
3. App Store Connect: create the app record (iOS, `com.mylife.meerkat`, name Meerkat) + non-consumable IAP `meerkat_app_unlock` at $4.99 (launch guide Step 6.1).
4. RevenueCat: iOS app keyed to the bundle id; put the `appl_` public key in `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` (EAS env var or eas.json production env). Optionally bake `MEERKAT_DEFAULT_RELAY_URL`.
5. Rebuild with env baked, `eas submit --platform ios`, then TestFlight > add self + friend as internal testers.
6. Web experience for the friend meanwhile: `artifacts/meerkat-testbed/start.sh tunnel` (real relay + web bundle, entitlement stubbed) and send the four items in the guide.

## Friend guide shipped

- `docs/guides/meerkat-friend-guide-2026-08-01.html` (+ `.md` twin): 13-section non-technical walkthrough covering both install paths (TestFlight and web PWA), first-run (age gate, name, safety code, unlock incl. sandbox vs Restore purchase), the every-device-is-its-own-identity warning, connection server setup, community join, pairing, manual sync, calls (Room honestly excluded), own-device linking, and bug reporting. Flows sourced from the verified 07-24 tester guide; opened in browser after creation.

## Files changed

- `docs/guides/meerkat-friend-guide-2026-08-01.{html,md}` (new)
- `memory.md` (session rows; 3 old rows archived to July archive to hold the 80-line budget)
- `docs/archives/memory-sessions-2026-07.md` (3 rows appended)
- This session log.

## Verification

- No function logic changed (docs + external build orchestration only); function gate not applicable.
- Local `expo export --platform ios` exit 0 is the bundle-phase evidence; EAS build result lands after this session's commit and will be recorded next session.
